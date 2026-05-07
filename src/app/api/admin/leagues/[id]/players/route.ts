import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: leagueId } = await params;
  const rows = await sql`
    SELECT player_id FROM league_players WHERE league_id = ${leagueId}
  `;

  return NextResponse.json(rows.map((r) => r.player_id));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: leagueId } = await params;
  const { playerIds } = await req.json();

  if (!Array.isArray(playerIds) || playerIds.length < 2) {
    return NextResponse.json({ error: 'At least 2 players required' }, { status: 400 });
  }

  for (const playerId of playerIds) {
    await sql`
      INSERT INTO league_players (league_id, player_id)
      VALUES (${leagueId}, ${playerId})
      ON CONFLICT (league_id, player_id) DO NOTHING
    `;
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: leagueId } = await params;
  const { playerId } = await req.json();

  await sql`
    DELETE FROM league_players WHERE league_id = ${leagueId} AND player_id = ${playerId}
  `;

  return NextResponse.json({ success: true });
}
