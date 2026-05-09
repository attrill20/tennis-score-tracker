import { auth } from '@/auth';
import sql from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { name, seasonStart, seasonEnd } = await req.json();

  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    await sql`UPDATE leagues SET name = ${name.trim()} WHERE id = ${id}`;
  }

  if (seasonStart !== undefined || seasonEnd !== undefined) {
    if (!seasonStart || !seasonEnd) {
      return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 });
    }
    if (seasonEnd <= seasonStart) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }
    await sql`UPDATE leagues SET season_start = ${seasonStart}, season_end = ${seasonEnd} WHERE id = ${id}`;
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await sql`DELETE FROM disputes WHERE match_id IN (SELECT id FROM matches WHERE league_id = ${id})`;
  await sql`DELETE FROM matches WHERE league_id = ${id}`;
  await sql`DELETE FROM league_players WHERE league_id = ${id}`;
  await sql`DELETE FROM leagues WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
