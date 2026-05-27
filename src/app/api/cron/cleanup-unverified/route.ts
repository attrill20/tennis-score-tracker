import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import sql from '@/lib/db';
import { sendVerificationReminderEmail, sendVerificationFinalWarningEmail } from '@/lib/mailer';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Users unverified for 1-2 days: send reminder with a fresh token
  const reminderUsers = await sql`
    SELECT id, email FROM profiles
    WHERE role = 'unverified'
      AND deleted_at IS NULL
      AND created_at < NOW() - INTERVAL '1 day'
      AND created_at >= NOW() - INTERVAL '2 days'
  `;

  // Users unverified for 5-6 days: send final warning with a fresh token
  const finalWarningUsers = await sql`
    SELECT id, email FROM profiles
    WHERE role = 'unverified'
      AND deleted_at IS NULL
      AND created_at < NOW() - INTERVAL '5 days'
      AND created_at >= NOW() - INTERVAL '6 days'
  `;

  // Users unverified for 7+ days: soft-delete (archive)
  const deleted = await sql`
    UPDATE profiles
    SET deleted_at = NOW()
    WHERE role = 'unverified'
      AND created_at < NOW() - INTERVAL '7 days'
      AND deleted_at IS NULL
    RETURNING id, email
  `;

  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  for (const user of reminderUsers) {
    const token = crypto.randomBytes(32).toString('hex');
    await sql`
      UPDATE profiles
      SET verification_token = ${token},
          verification_token_expires = ${expires.toISOString()}
      WHERE id = ${user.id}
    `;
    await sendVerificationReminderEmail(user.email as string, token);
  }

  for (const user of finalWarningUsers) {
    const token = crypto.randomBytes(32).toString('hex');
    await sql`
      UPDATE profiles
      SET verification_token = ${token},
          verification_token_expires = ${expires.toISOString()}
      WHERE id = ${user.id}
    `;
    await sendVerificationFinalWarningEmail(user.email as string, token);
  }

  return NextResponse.json({
    reminders: reminderUsers.map((u) => u.email),
    finalWarnings: finalWarningUsers.map((u) => u.email),
    deleted: deleted.map((u) => u.email),
  });
}
