import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';

export type PlaceholderInput = {
  fullName: string;
  alias: string | null;
  anonymized: boolean;
};

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex === -1) return { firstName: trimmed, lastName: '' };
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1) };
}

export async function createPlaceholder(input: PlaceholderInput): Promise<string> {
  const { firstName, lastName } = splitFullName(input.fullName);
  const email = `placeholder-${crypto.randomUUID()}@placeholder.internal`;
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12);

  const [row] = await sql`
    INSERT INTO profiles (
      email, full_name, first_name, last_name, password_hash, role,
      email_verified, is_active, member_number,
      is_placeholder, placeholder_alias, placeholder_anonymized
    )
    VALUES (
      ${email}, ${input.fullName.trim()}, ${firstName}, ${lastName}, ${passwordHash}, 'member',
      true, true, NULL,
      true, ${input.alias}, ${input.anonymized}
    )
    RETURNING id
  `;
  return row.id as string;
}

export async function updatePlaceholder(id: string, input: PlaceholderInput): Promise<void> {
  const { firstName, lastName } = splitFullName(input.fullName);
  await sql`
    UPDATE profiles SET
      full_name = ${input.fullName.trim()},
      first_name = ${firstName},
      last_name = ${lastName},
      placeholder_alias = ${input.alias},
      placeholder_anonymized = ${input.anonymized}
    WHERE id = ${id} AND is_placeholder = true
  `;
}

export async function retirePlaceholder(id: string): Promise<void> {
  await sql`
    UPDATE profiles SET deleted_at = NOW()
    WHERE id = ${id} AND is_placeholder = true
  `;
}

export class MergeConflictError extends Error {}

/**
 * Re-points every match/league_players/league_player_drafts row referencing a placeholder onto
 * a real member's account (e.g. once that member decides to register properly), then retires
 * the placeholder. Refuses if the real account is already in one of the same leagues (active or
 * drafted) under its own id, since that would collide with the (league_id, player_id)
 * uniqueness constraint each of those tables has.
 */
export async function mergePlaceholderIntoAccount(placeholderId: string, realAccountId: string): Promise<void> {
  const [placeholder] = await sql`SELECT id FROM profiles WHERE id = ${placeholderId} AND is_placeholder = true`;
  if (!placeholder) throw new Error('Placeholder not found');

  const [realAccount] = await sql`
    SELECT id FROM profiles WHERE id = ${realAccountId} AND is_placeholder = false AND deleted_at IS NULL
  `;
  if (!realAccount) throw new Error('Target account not found');

  const conflicts = await sql`
    (SELECT league_id FROM league_players WHERE player_id = ${placeholderId}
     INTERSECT
     SELECT league_id FROM league_players WHERE player_id = ${realAccountId})
    UNION
    (SELECT league_id FROM league_player_drafts WHERE player_id = ${placeholderId}
     INTERSECT
     SELECT league_id FROM league_player_drafts WHERE player_id = ${realAccountId})
  `;
  if (conflicts.length > 0) {
    throw new MergeConflictError(
      'That account is already assigned to the same league as this placeholder - remove one of them from the league first.'
    );
  }

  await sql`BEGIN`;
  try {
    await sql`UPDATE matches SET player1_id = ${realAccountId} WHERE player1_id = ${placeholderId}`;
    await sql`UPDATE matches SET player2_id = ${realAccountId} WHERE player2_id = ${placeholderId}`;
    await sql`UPDATE matches SET player3_id = ${realAccountId} WHERE player3_id = ${placeholderId}`;
    await sql`UPDATE matches SET player4_id = ${realAccountId} WHERE player4_id = ${placeholderId}`;
    await sql`UPDATE matches SET winner_id = ${realAccountId} WHERE winner_id = ${placeholderId}`;
    await sql`UPDATE matches SET pending_winner_id = ${realAccountId} WHERE pending_winner_id = ${placeholderId}`;
    await sql`UPDATE league_players SET player_id = ${realAccountId} WHERE player_id = ${placeholderId}`;
    await sql`UPDATE league_players SET partner_id = ${realAccountId} WHERE partner_id = ${placeholderId}`;
    await sql`UPDATE league_player_drafts SET player_id = ${realAccountId} WHERE player_id = ${placeholderId}`;
    await sql`UPDATE league_player_drafts SET partner_id = ${realAccountId} WHERE partner_id = ${placeholderId}`;
    await sql`UPDATE profiles SET deleted_at = NOW() WHERE id = ${placeholderId}`;
    await sql`COMMIT`;
  } catch (e) {
    await sql`ROLLBACK`;
    throw e;
  }
}

/**
 * If `playerId` is a placeholder, finds another (distinct) player already playing - active or
 * drafted into an upcoming round - somewhere in the given tournament under the same name. Used
 * to refuse adding a placeholder to a tournament that already has someone else with that name,
 * so nobody has to guess which "John Smith" a result belongs to. Returns null for a non-placeholder
 * `playerId` or when there's no such conflict.
 */
export async function findPlaceholderTournamentNameConflict(
  playerId: string,
  tournamentId: string
): Promise<{ id: string; fullName: string } | null> {
  const [row] = await sql`
    SELECT p2.id, p2.full_name
    FROM profiles p1
    JOIN profiles p2
      ON LOWER(p2.first_name) = LOWER(p1.first_name) AND LOWER(p2.last_name) = LOWER(p1.last_name)
      AND p2.id != p1.id
    WHERE p1.id = ${playerId} AND p1.is_placeholder = true
      AND p2.id IN (
        SELECT lp.player_id FROM league_players lp JOIN leagues l ON l.id = lp.league_id WHERE l.tournament_id = ${tournamentId}
        UNION
        SELECT lpd.player_id FROM league_player_drafts lpd JOIN leagues l ON l.id = lpd.league_id WHERE l.tournament_id = ${tournamentId}
      )
    LIMIT 1
  `;
  return row ? { id: row.id as string, fullName: row.full_name as string } : null;
}

export type PlaceholderMatch = {
  placeholderId: string;
  placeholderFullName: string;
  placeholderAlias: string | null;
  placeholderAnonymized: boolean;
  memberId: string;
  memberFullName: string;
  memberEmailVerified: boolean;
};

function mapPlaceholderMatchRow(r: Record<string, unknown>): PlaceholderMatch {
  return {
    placeholderId: r.placeholder_id as string,
    placeholderFullName: r.placeholder_full_name as string,
    placeholderAlias: r.placeholder_alias as string | null,
    placeholderAnonymized: r.placeholder_anonymized as boolean,
    memberId: r.member_id as string,
    memberFullName: r.member_full_name as string,
    memberEmailVerified: r.member_email_verified as boolean,
  };
}

/**
 * Every currently-active placeholder whose name exactly matches a currently-active real member's
 * name - almost always because that member just registered under their real name. Computed live
 * on every call rather than stored anywhere, since a match resolves itself the moment either side
 * is renamed or the placeholder is swapped into the real account.
 */
export async function getPlaceholderNameMatches(): Promise<PlaceholderMatch[]> {
  const rows = await sql`
    SELECT ph.id AS placeholder_id, ph.full_name AS placeholder_full_name,
           ph.placeholder_alias, ph.placeholder_anonymized,
           m.id AS member_id, m.full_name AS member_full_name, m.email_verified AS member_email_verified
    FROM profiles ph
    JOIN profiles m
      ON LOWER(m.first_name) = LOWER(ph.first_name) AND LOWER(m.last_name) = LOWER(ph.last_name)
    WHERE ph.is_placeholder = true AND ph.deleted_at IS NULL
      AND m.is_placeholder = false AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC
  `;
  return rows.map(mapPlaceholderMatchRow);
}

/**
 * Same as `getPlaceholderNameMatches`, restricted to placeholders currently playing - active or
 * drafted into an upcoming round - somewhere in the given tournament.
 */
export async function getPlaceholderNameMatchesForTournament(tournamentId: string): Promise<PlaceholderMatch[]> {
  const rows = await sql`
    SELECT ph.id AS placeholder_id, ph.full_name AS placeholder_full_name,
           ph.placeholder_alias, ph.placeholder_anonymized,
           m.id AS member_id, m.full_name AS member_full_name, m.email_verified AS member_email_verified
    FROM profiles ph
    JOIN profiles m
      ON LOWER(m.first_name) = LOWER(ph.first_name) AND LOWER(m.last_name) = LOWER(ph.last_name)
    WHERE ph.is_placeholder = true AND ph.deleted_at IS NULL
      AND m.is_placeholder = false AND m.deleted_at IS NULL
      AND ph.id IN (
        SELECT lp.player_id FROM league_players lp JOIN leagues l ON l.id = lp.league_id WHERE l.tournament_id = ${tournamentId}
        UNION
        SELECT lpd.player_id FROM league_player_drafts lpd JOIN leagues l ON l.id = lpd.league_id WHERE l.tournament_id = ${tournamentId}
      )
    ORDER BY m.created_at DESC
  `;
  return rows.map(mapPlaceholderMatchRow);
}
