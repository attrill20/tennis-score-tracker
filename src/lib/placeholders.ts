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
 * Re-points every match/league_players row referencing a placeholder onto a real member's
 * account (e.g. once that member decides to register properly), then retires the placeholder.
 * Refuses if the real account is already in one of the same leagues under its own id, since
 * that would collide with the league_players (league_id, player_id) uniqueness constraint.
 */
export async function mergePlaceholderIntoAccount(placeholderId: string, realAccountId: string): Promise<void> {
  const [placeholder] = await sql`SELECT id FROM profiles WHERE id = ${placeholderId} AND is_placeholder = true`;
  if (!placeholder) throw new Error('Placeholder not found');

  const [realAccount] = await sql`
    SELECT id FROM profiles WHERE id = ${realAccountId} AND is_placeholder = false AND deleted_at IS NULL
  `;
  if (!realAccount) throw new Error('Target account not found');

  const conflicts = await sql`
    SELECT league_id FROM league_players WHERE player_id = ${placeholderId}
    INTERSECT
    SELECT league_id FROM league_players WHERE player_id = ${realAccountId}
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
    await sql`UPDATE profiles SET deleted_at = NOW() WHERE id = ${placeholderId}`;
    await sql`COMMIT`;
  } catch (e) {
    await sql`ROLLBACK`;
    throw e;
  }
}
