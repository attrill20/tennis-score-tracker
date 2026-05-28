import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const firstName = searchParams.get('firstName')?.trim();
  const lastName = searchParams.get('lastName')?.trim();

  if (!firstName || !lastName) {
    return NextResponse.json({ taken: false });
  }

  const session = await auth();

  const rows = session
    ? await sql`
        SELECT id FROM profiles
        WHERE LOWER(first_name) = LOWER(${firstName}) AND LOWER(last_name) = LOWER(${lastName})
        AND id != ${session.user.id}
      `
    : await sql`
        SELECT id FROM profiles
        WHERE LOWER(first_name) = LOWER(${firstName}) AND LOWER(last_name) = LOWER(${lastName})
      `;

  return NextResponse.json({ taken: rows.length > 0 });
}
