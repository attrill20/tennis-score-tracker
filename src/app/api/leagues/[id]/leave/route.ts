import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: leagueId } = await params;
  const userId = session.user.id;

  const leagues = await sql`SELECT join_type, status FROM leagues WHERE id = ${leagueId}`;
  const league = leagues[0];
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

  if (league.join_type !== 'open_invite') {
    return NextResponse.json({ error: 'You cannot leave an invite-only league' }, { status: 403 });
  }

  if (league.status !== 'upcoming') {
    return NextResponse.json({ error: 'You can only leave a league before it has started' }, { status: 400 });
  }

  const membership = await sql`
    SELECT 1 FROM league_players WHERE league_id = ${leagueId} AND player_id = ${userId}
  `;
  if (membership.length === 0) {
    return NextResponse.json({ error: 'You are not in this league' }, { status: 400 });
  }

  await sql`DELETE FROM league_players WHERE league_id = ${leagueId} AND player_id = ${userId}`;

  return NextResponse.json({ success: true });
}
