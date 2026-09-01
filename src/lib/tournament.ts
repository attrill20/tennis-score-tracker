import sql from '@/lib/db';
import { calculateStandings, type Tiebreaker } from '@/lib/league';
import { computePromotionMoves, computePromotionMovesWithNoShows, type ZeroMatchesPolicy } from '@/lib/promotion';

export { computePromotionMoves };

function statusForStart(startDate: string): 'upcoming' | 'active' {
  const today = new Date().toISOString().split('T')[0];
  return startDate > today ? 'upcoming' : 'active';
}

type DivisionRow = {
  id: string;
  name: string;
  division_order: number;
  league_type: string;
  max_players: number;
  scoring_method: string;
  tiebreaker: string;
  is_public: boolean;
  color: string | null;
  points_config: import('@/lib/league').PointsConfig | null;
  gender_category: string;
};

/**
 * Generate the divisions for the round after `completedRound` of a multi-league tournament,
 * applying promotion/relegation from the completed round's standings.
 *
 * Idempotent: if the next round already exists it does nothing. Returns the ids of the
 * divisions created (empty if nothing was generated).
 */
export async function generateNextRound(tournamentId: string, completedRound: number): Promise<string[]> {
  const tRows = await sql`SELECT * FROM tournaments WHERE id = ${tournamentId} AND format = 'multi'`;
  if (tRows.length === 0) return [];
  const t = tRows[0] as {
    num_promoted: number;
    num_relegated: number;
    num_rounds: number;
    scoring_method: string;
    points_config: import('@/lib/league').PointsConfig | null;
    zero_matches_policy: ZeroMatchesPolicy;
  };

  const nextRound = completedRound + 1;
  if (nextRound > t.num_rounds) {
    await sql`UPDATE tournaments SET status = 'completed' WHERE id = ${tournamentId} AND status <> 'archived'`;
    return [];
  }

  // Already generated?
  const existing = await sql`
    SELECT 1 FROM leagues WHERE tournament_id = ${tournamentId} AND round_number = ${nextRound} LIMIT 1
  `;
  if (existing.length > 0) return [];

  const divisions = (await sql`
    SELECT id, name, division_order, league_type, max_players, scoring_method, tiebreaker, is_public, color, points_config, gender_category
    FROM leagues
    WHERE tournament_id = ${tournamentId} AND round_number = ${completedRound}
    ORDER BY division_order ASC
  `) as unknown as DivisionRow[];
  if (divisions.length === 0) return [];

  // Build ordered standings (player ids + matches played, best first) for each division.
  const standings: { id: string; played: number }[][] = [];
  for (const div of divisions) {
    const players = (await sql`
      SELECT p.id, (p.first_name || ' ' || p.last_name) AS full_name
      FROM league_players lp JOIN profiles p ON p.id = lp.player_id
      WHERE lp.league_id = ${div.id}
    `) as unknown as { id: string; full_name: string }[];

    const matches = (await sql`
      SELECT player1_id, player2_id, player3_id, player4_id, score_player1, score_player2, status, match_type, winner_id
      FROM matches WHERE league_id = ${div.id}
    `) as unknown as Parameters<typeof calculateStandings>[1];

    const ordered = calculateStandings(players, matches, (div.tiebreaker as Tiebreaker) ?? 'head_to_head', div.points_config ?? undefined);
    standings.push(ordered.map((s) => ({ id: s.id, played: s.played })));
  }

  const nextMembership = computePromotionMovesWithNoShows(standings, t.num_promoted, t.num_relegated, t.zero_matches_policy ?? 'relegate');

  // Guard against resurrecting a player who deleted their account mid-tournament.
  const allCandidateIds = nextMembership.flat();
  const deletedRows = allCandidateIds.length > 0 ? await sql`
    SELECT id FROM profiles WHERE deleted_at IS NOT NULL AND id = ANY(${allCandidateIds}::uuid[])
  ` : [];
  const deletedIds = new Set(deletedRows.map((r) => r.id as string));

  // Resolve this round's start/end as plain YYYY-MM-DD strings in SQL to dodge JS Date
  // timezone shifts. Postgres arrays are 1-indexed, so round N's date is round_dates[N].
  const [dateRow] = await sql`
    SELECT
      (round_dates[${nextRound}])::text AS start_date,
      CASE WHEN round_dates[${nextRound + 1}] IS NOT NULL
           THEN (round_dates[${nextRound + 1}] - 1)::text
           ELSE final_end::text END AS end_date
    FROM tournaments WHERE id = ${tournamentId}
  `;
  const start = (dateRow?.start_date as string) ?? new Date().toISOString().slice(0, 10);
  const end = (dateRow?.end_date as string) ?? start;
  const status = statusForStart(start);

  const createdIds: string[] = [];
  for (let d = 0; d < divisions.length; d++) {
    const template = divisions[d];
    const [div] = await sql`
      INSERT INTO leagues (name, season_start, season_end, status, max_players, scoring_method, num_promoted, num_relegated, tiebreaker, created_by, is_public, join_type, description, league_type, color, tournament_id, round_number, division_order, points_config, gender_category)
      VALUES (${template.name}, ${start}, ${end}, ${status}, ${template.max_players}, ${t.scoring_method}, ${t.num_promoted}, ${t.num_relegated}, ${template.tiebreaker}, ${null}, ${template.is_public}, 'invite_only', ${null}, ${template.league_type}, ${template.color}, ${tournamentId}, ${nextRound}, ${template.division_order}, ${t.points_config ? JSON.stringify(t.points_config) : null}, ${template.gender_category})
      RETURNING id
    `;
    const newDivisionId = div.id as string;
    createdIds.push(newDivisionId);

    // While the new round is still upcoming, stage memberships as drafts so they stay
    // invisible until the round actually activates (see src/lib/divisionDrafts.ts).
    const targetTable = status === 'upcoming' ? 'league_player_drafts' : 'league_players';
    for (const playerId of nextMembership[d]) {
      if (deletedIds.has(playerId)) continue;
      if (targetTable === 'league_player_drafts') {
        await sql`
          INSERT INTO league_player_drafts (league_id, player_id)
          VALUES (${newDivisionId}, ${playerId})
          ON CONFLICT (league_id, player_id) DO NOTHING
        `;
      } else {
        await sql`
          INSERT INTO league_players (league_id, player_id)
          VALUES (${newDivisionId}, ${playerId})
          ON CONFLICT (league_id, player_id) DO NOTHING
        `;
      }
    }
  }

  // The round we just promoted/relegated from is finished.
  await sql`
    UPDATE leagues SET status = 'completed'
    WHERE tournament_id = ${tournamentId} AND round_number = ${completedRound} AND status <> 'archived'
  `;

  await sql`UPDATE tournaments SET status = 'active' WHERE id = ${tournamentId} AND status = 'upcoming'`;
  return createdIds;
}
