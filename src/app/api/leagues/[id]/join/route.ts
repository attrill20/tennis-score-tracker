import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: leagueId } = await params;
  const userId = session.user.id;

  const leagues = await sql`
    SELECT id, join_type, max_players, league_type, status,
      (SELECT COUNT(*) FROM league_players WHERE league_id = id) AS player_count
    FROM leagues WHERE id = ${leagueId}
  `;
  const league = leagues[0];
  if (!league) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

  if (league.join_type !== 'open_invite') {
    return NextResponse.json({ error: 'This league is invite-only' }, { status: 403 });
  }

  if (league.status === 'completed') {
    return NextResponse.json({ error: 'This league has already finished' }, { status: 400 });
  }

  const alreadyMember = await sql`
    SELECT 1 FROM league_players WHERE league_id = ${leagueId} AND player_id = ${userId}
  `;
  if (alreadyMember.length > 0) {
    return NextResponse.json({ error: 'You are already in this league' }, { status: 400 });
  }

  const playerCount = Number(league.player_count);
  const unitCount = league.league_type === 'doubles' ? Math.floor(playerCount / 2) : playerCount;
  if (unitCount >= Number(league.max_players)) {
    return NextResponse.json({ error: 'This league is full' }, { status: 400 });
  }

  await sql`INSERT INTO league_players (league_id, player_id) VALUES (${leagueId}, ${userId})`;

  return NextResponse.json({ success: true });
}
