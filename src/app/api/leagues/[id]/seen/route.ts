import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: leagueId } = await params;
  const { type } = await req.json();

  if (type === 'started') {
    await sql`UPDATE league_players SET started_seen = true WHERE league_id = ${leagueId} AND player_id = ${session.user.id}`;
  } else if (type === 'ended') {
    await sql`UPDATE league_players SET ended_seen = true WHERE league_id = ${leagueId} AND player_id = ${session.user.id}`;
  } else {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
