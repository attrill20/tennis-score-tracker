import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import sql from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const rows = await sql`SELECT id, email_verified FROM profiles WHERE email = ${email}`;

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No account found with that email address' }, { status: 404 });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await sql`
    UPDATE profiles
    SET reset_token = ${resetToken},
        reset_token_expires = ${resetTokenExpires.toISOString()}
    WHERE email = ${email}
  `;

  await sendPasswordResetEmail(email, resetToken);

  return NextResponse.json({ success: true });
}
