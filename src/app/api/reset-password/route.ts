import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const rows = await sql`
    SELECT id FROM profiles
    WHERE reset_token = ${token}
      AND reset_token_expires > NOW()
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: 'This reset link is invalid or has expired' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await sql`
    UPDATE profiles
    SET password_hash = ${passwordHash},
        reset_token = NULL,
        reset_token_expires = NULL
    WHERE id = ${rows[0].id}
  `;

  return NextResponse.json({ success: true });
}
