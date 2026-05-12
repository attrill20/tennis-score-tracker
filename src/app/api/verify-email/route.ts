import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', req.url));
  }

  const rows = await sql`
    SELECT id FROM profiles
    WHERE verification_token = ${token}
      AND verification_token_expires > NOW()
      AND email_verified = false
  `;

  if (rows.length === 0) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', req.url));
  }

  await sql`
    UPDATE profiles
    SET email_verified = true,
        verification_token = NULL,
        verification_token_expires = NULL
    WHERE id = ${rows[0].id}
  `;

  return NextResponse.redirect(new URL('/login?verified=true', req.url));
}
