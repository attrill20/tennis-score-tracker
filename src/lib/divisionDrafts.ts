import sql from '@/lib/db';

export type DraftDivision = {
  id: string;
  name: string;
  division_order: number;
  max_players: number;
  league_type: string;
  status: string;
};

/**
 * The current round's divisions for a multi-format tournament, ordered weakest-division-last
 * (division_order ascending). Used by the Assign Divisions tool to scope every operation to
 * "the round being managed right now" - round 1 for a brand-new tournament, or whichever
 * round is still upcoming if an admin is tweaking it before it activates.
 */
export async function getCurrentRoundDivisions(tournamentId: string): Promise<DraftDivision[]> {
  const rows = await sql`
    SELECT id, name, division_order, max_players, league_type, status
    FROM leagues
    WHERE tournament_id = ${tournamentId}
      AND round_number = (SELECT COALESCE(MAX(round_number), 1) FROM leagues WHERE tournament_id = ${tournamentId})
    ORDER BY division_order ASC
  `;
  return rows as unknown as DraftDivision[];
}

/**
 * Deletes one league and everything that references it: disputes (via its matches), matches,
 * league_players, league_player_drafts, and clears tournament_registrations.assigned_league_id
 * for anyone pointed at it - shared by the per-division delete button and the divisions-resize
 * flow below so both leave the same clean state behind.
 */
export async function deleteLeagueCascade(leagueId: string): Promise<void> {
  await sql`DELETE FROM disputes WHERE match_id IN (SELECT id FROM matches WHERE league_id = ${leagueId})`;
  await sql`DELETE FROM matches WHERE league_id = ${leagueId}`;
  await sql`DELETE FROM league_players WHERE league_id = ${leagueId}`;
  await sql`DELETE FROM league_player_drafts WHERE league_id = ${leagueId}`;
  await sql`UPDATE tournament_registrations SET assigned_league_id = NULL, updated_at = now() WHERE assigned_league_id = ${leagueId}`;
  await sql`DELETE FROM leagues WHERE id = ${leagueId}`;
}

export type ResizeDivisionsResult =
  | { status: 'ok'; created: number; removed: number }
  | { status: 'needs_confirmation'; message: string }
  | { status: 'error'; message: string };

/**
 * Changes how many divisions the tournament's current round has - only while every division in
 * that round is still 'upcoming' (before it goes active), since resizing an already-running
 * round would mean reshuffling real matches. Growing clones the settings of the last (weakest)
 * division for each new one added. Shrinking removes the bottom (highest division_order)
 * division(s) - if any has drafted players, it refuses unless `force` is set, in which case
 * those players are returned to the unassigned pool (deleteLeagueCascade clears their drafts).
 */
export async function resizeCurrentRoundDivisions(
  tournamentId: string,
  newCount: number,
  force: boolean
): Promise<ResizeDivisionsResult> {
  const divisions = await getCurrentRoundDivisions(tournamentId);
  if (divisions.length === 0) {
    return { status: 'error', message: 'This tournament has no current-round divisions' };
  }
  if (divisions.some((d) => d.status !== 'upcoming')) {
    return { status: 'error', message: 'The number of divisions can only be changed while the current round has not started yet' };
  }

  const currentCount = divisions.length;
  if (newCount === currentCount) {
    return { status: 'ok', created: 0, removed: 0 };
  }

  if (newCount > currentCount) {
    const [roundRow] = await sql`SELECT MAX(round_number) AS round_number FROM leagues WHERE tournament_id = ${tournamentId}`;
    const template = divisions[divisions.length - 1];
    const [templateRow] = await sql`
      SELECT season_start, season_end, max_players, scoring_method, num_promoted, num_relegated,
        tiebreaker, is_public, league_type, color, points_config, gender_category
      FROM leagues WHERE id = ${template.id}
    `;
    const toCreate = newCount - currentCount;
    for (let i = 0; i < toCreate; i++) {
      const order = currentCount + i + 1;
      await sql`
        INSERT INTO leagues (
          name, season_start, season_end, status, max_players, scoring_method, num_promoted, num_relegated,
          tiebreaker, is_public, join_type, league_type, color, tournament_id, round_number, division_order,
          points_config, gender_category
        )
        VALUES (
          ${`Division ${order}`}, ${templateRow.season_start}, ${templateRow.season_end}, 'upcoming',
          ${templateRow.max_players}, ${templateRow.scoring_method}, ${templateRow.num_promoted}, ${templateRow.num_relegated},
          ${templateRow.tiebreaker}, ${templateRow.is_public}, 'invite_only', ${templateRow.league_type}, ${templateRow.color},
          ${tournamentId}, ${roundRow.round_number}, ${order},
          ${templateRow.points_config ? JSON.stringify(templateRow.points_config) : null}, ${templateRow.gender_category}
        )
      `;
    }
    await sql`UPDATE tournaments SET num_divisions = ${newCount} WHERE id = ${tournamentId}`;
    return { status: 'ok', created: toCreate, removed: 0 };
  }

  // Shrinking: drop the bottom (newCount..currentCount) divisions.
  const toRemove = divisions.slice(newCount);
  if (!force) {
    const counts = await Promise.all(toRemove.map(async (d) => {
      const [{ count }] = await sql`SELECT COUNT(*) FROM league_player_drafts WHERE league_id = ${d.id}`;
      return { name: d.name, draftedCount: Number(count) };
    }));
    const affected = counts.filter((c) => c.draftedCount > 0);
    const totalDrafted = affected.reduce((sum, c) => sum + c.draftedCount, 0);
    if (totalDrafted > 0) {
      const names = affected.map((c) => c.name).join(', ');
      return {
        status: 'needs_confirmation',
        message: `${totalDrafted} player${totalDrafted === 1 ? ' is' : 's are'} already drafted into ${names} - they'll be returned to the unassigned pool. Continue?`,
      };
    }
  }

  for (const d of toRemove) {
    await deleteLeagueCascade(d.id);
  }
  await sql`UPDATE tournaments SET num_divisions = ${newCount} WHERE id = ${tournamentId}`;
  return { status: 'ok', created: 0, removed: toRemove.length };
}

/**
 * Copies every draft assignment for the given (now-active) leagues into real
 * league_players rows, sets tournament_registrations.assigned_league_id for anyone
 * materialized this way (the only place that column gets set for a drafted player -
 * never at draft time, since the registration page reveals it immediately), then
 * clears the drafts. Safe to call with leagues that have no drafts.
 */
export async function materializeDraftsForLeagues(leagueIds: string[]): Promise<void> {
  if (leagueIds.length === 0) return;

  await sql`BEGIN`;
  try {
    await sql`
      WITH inserted AS (
        INSERT INTO league_players (league_id, player_id, partner_id)
        SELECT league_id, player_id, partner_id FROM league_player_drafts
        WHERE league_id = ANY(${leagueIds}::uuid[])
        ON CONFLICT (league_id, player_id) DO NOTHING
        RETURNING league_id, player_id
      )
      UPDATE tournament_registrations tr
      SET assigned_league_id = inserted.league_id, updated_at = now()
      FROM inserted
      JOIN leagues l ON l.id = inserted.league_id
      WHERE tr.player_id = inserted.player_id AND tr.tournament_id = l.tournament_id
    `;
    await sql`DELETE FROM league_player_drafts WHERE league_id = ANY(${leagueIds}::uuid[])`;
    await sql`COMMIT`;
  } catch (e) {
    await sql`ROLLBACK`;
    throw e;
  }
}
