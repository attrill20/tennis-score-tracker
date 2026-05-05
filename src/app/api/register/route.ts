import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';

export async function POST(req: NextRequest) {
  const { email, password, title, firstName, lastName } = await req.json();

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

  await sql`
    INSERT INTO profiles (email, full_name, title, first_name, last_name, password_hash, role)
    VALUES (${email}, ${fullName}, ${title || null}, ${firstName}, ${lastName}, ${passwordHash}, 'member')
  `;

  return NextResponse.json({ success: true }, { status: 201 });
}
