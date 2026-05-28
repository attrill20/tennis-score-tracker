import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const field = searchParams.get('field');
  const value = searchParams.get('value')?.trim();

  if (!field || !value) return NextResponse.json({ taken: false });

  const session = await auth();

  if (field === 'email') {
    const normalised = value.toLowerCase();
    const rows = session
      ? await sql`SELECT id FROM profiles WHERE LOWER(email) = ${normalised} AND id != ${session.user.id}`
      : await sql`SELECT id FROM profiles WHERE LOWER(email) = ${normalised}`;
    return NextResponse.json({ taken: rows.length > 0 });
  }

  if (field === 'phone') {
    // Strip all non-digit chars except leading + for comparison
    const normalised = value.replace(/(?!^\+)\D/g, '');
    const rows = session
      ? await sql`SELECT id FROM profiles WHERE REGEXP_REPLACE(phone, '[^0-9+]', '', 'g') = ${normalised} AND id != ${session.user.id}`
      : await sql`SELECT id FROM profiles WHERE REGEXP_REPLACE(phone, '[^0-9+]', '', 'g') = ${normalised}`;
    return NextResponse.json({ taken: rows.length > 0 });
  }

  return NextResponse.json({ taken: false });
}
