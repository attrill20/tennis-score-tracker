import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { del } from '@vercel/blob';
import sql from '@/lib/db';

export async function softDeleteAccount(userId: string): Promise<void> {
  const rows = await sql`SELECT avatar_url FROM profiles WHERE id = ${userId}`;
  const avatarUrl = rows[0]?.avatar_url as string | null;

  if (avatarUrl) {
    try { await del(avatarUrl, { token: process.env.BLOB_READ_WRITE_TOKEN }); } catch { /* ignore */ }
  }

  const unusableHash = await bcrypt.hash(crypto.randomUUID(), 12);

  await sql`
    UPDATE profiles SET
      first_name = 'Deleted',
      last_name = 'User',
      full_name = 'Deleted User',
      email = ${'deleted-' + userId + '@deleted.invalid'},
      phone = NULL,
      gender = NULL,
      title = NULL,
      avatar_url = NULL,
      password_hash = ${unusableHash},
      verification_token = NULL,
      verification_token_expires = NULL,
      reset_token = NULL,
      reset_token_expires = NULL,
      deleted_at = NOW()
    WHERE id = ${userId}
  `;
}
