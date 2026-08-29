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
