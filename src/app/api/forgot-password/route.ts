import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import sql from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  const { email: rawEmail } = await req.json();
  const email = rawEmail?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const rows = await sql`SELECT id, email, email_verified FROM profiles WHERE LOWER(email) = ${email}`;

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No account found with that email address' }, { status: 404 });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await sql`
    UPDATE profiles
    SET reset_token = ${resetToken},
        reset_token_expires = ${resetTokenExpires.toISOString()}
    WHERE LOWER(email) = ${email}
  `;

  try {
    await sendPasswordResetEmail(rows[0].email as string, resetToken);
  } catch (err) {
    console.error('Failed to send password reset email:', err);
  }

  return NextResponse.json({ success: true });
}
