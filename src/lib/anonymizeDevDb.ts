import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

// Known password for every profile in the dev database after a sync.
// Not a secret worth protecting - it only ever unlocks anonymized dev data.
export const DEV_DATABASE_PASSWORD = 'devpassword123';

// Scrubs real member details (emails, names, password hashes, contact info,
// auth tokens) out of the dev branch after it's reset from prod, so a copy
// of real member data never sits in the less-guarded dev database.
export async function anonymizeDevDatabase() {
  const devUrl = process.env.DEV_DATABASE_URL;
  if (!devUrl) {
    throw new Error('DEV_DATABASE_URL is not set - refusing to run anonymization');
  }
  if (devUrl === process.env.DATABASE_URL) {
    throw new Error(
      'DEV_DATABASE_URL matches DATABASE_URL - refusing to anonymize what looks like the production database'
    );
  }

  const sql = neon(devUrl);
  const devPasswordHash = await bcrypt.hash(DEV_DATABASE_PASSWORD, 12);

  const updated = await sql`
    UPDATE profiles p
    SET
      email = 'player' || sub.rn || '@example.test',
      full_name = 'Test Player ' || sub.rn,
      first_name = 'Test',
      last_name = 'Player ' || sub.rn,
      password_hash = ${devPasswordHash},
      phone = NULL,
      avatar_url = NULL,
      verification_token = NULL,
      verification_token_expires = NULL,
      reset_token = NULL,
      reset_token_expires = NULL
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn FROM profiles
    ) sub
    WHERE p.id = sub.id
    RETURNING p.id
  `;

  return {
    anonymizedProfiles: updated.length,
    devPassword: DEV_DATABASE_PASSWORD,
  };
}
