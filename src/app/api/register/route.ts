import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import sql from '@/lib/db';
import { sendVerificationEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  const { email, password, title, firstName, lastName, phone } = await req.json();

  if (!email || !password || !firstName || !lastName) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const existing = await sql`SELECT id FROM profiles WHERE email = ${email}`;
  if (existing.length > 0) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const fullName = [title, firstName, lastName].filter(Boolean).join(' ');
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO profiles (
      email, full_name, title, first_name, last_name, phone, password_hash, role,
      email_verified, verification_token, verification_token_expires
    )
    VALUES (
      ${email}, ${fullName}, ${title || null}, ${firstName}, ${lastName}, ${phone || null}, ${passwordHash}, 'member',
      false, ${verificationToken}, ${verificationTokenExpires.toISOString()}
    )
  `;

  await sendVerificationEmail(email, verificationToken);

  return NextResponse.json({ success: true }, { status: 201 });
}
