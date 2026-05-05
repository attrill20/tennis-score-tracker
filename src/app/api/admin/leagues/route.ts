import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, startDate, endDate, status } = await req.json();

  if (!name || !startDate || !endDate) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  await sql`
    INSERT INTO leagues (name, season_start, season_end, status, created_by)
    VALUES (${name}, ${startDate}, ${endDate}, ${status ?? 'upcoming'}, ${session.user.id})
  `;

  return NextResponse.json({ success: true }, { status: 201 });
}
