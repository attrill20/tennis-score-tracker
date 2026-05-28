import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import sql from '@/lib/db';
import { sendVerificationEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  const { email: rawEmail, password, firstName, lastName, phone, gender } = await req.json();
  const email = rawEmail?.toLowerCase().trim();

  if (!email || !password || !firstName || !lastName || !gender) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  if (!['mens', 'womens'].includes(gender)) {
    return NextResponse.json({ error: 'Invalid gender selection' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const existing = await sql`SELECT id FROM profiles WHERE LOWER(email) = ${email}`;
  if (existing.length > 0) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  const nameClash = await sql`
    SELECT id FROM profiles
    WHERE LOWER(first_name) = LOWER(${firstName}) AND LOWER(last_name) = LOWER(${lastName})
  `;
  if (nameClash.length > 0) {
    return NextResponse.json({
      error: `A member called ${firstName} ${lastName} is already registered - please add a slightly different name to distinguish yourself from the other member, e.g. a middle name or initial, a nickname, or a shortened version (e.g. Dan instead of Daniel).`,
    }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const fullName = [firstName, lastName].join(' ');
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO profiles (
      email, full_name, first_name, last_name, phone, gender, password_hash, role,
      email_verified, verification_token, verification_token_expires
    )
    VALUES (
      ${email}, ${fullName}, ${firstName}, ${lastName}, ${phone}, ${gender}, ${passwordHash}, 'unverified',
      false, ${verificationToken}, ${verificationTokenExpires.toISOString()}
    )
  `;

  await sendVerificationEmail(email, verificationToken);

  return NextResponse.json({ success: true }, { status: 201 });
}
