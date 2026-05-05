import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { leagueId, opponentId, myScore, theirScore, playedAt } = await req.json();

  if (!leagueId || !opponentId || myScore === undefined || theirScore === undefined || !playedAt) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  if (myScore === theirScore) {
    return NextResponse.json({ error: 'Scores cannot be a draw' }, { status: 400 });
  }

  // Verify both players are in the league
  const membership = await sql`
    SELECT player_id FROM league_players
    WHERE league_id = ${leagueId}
    AND player_id IN (${session.user.id}, ${opponentId})
  `;

  if (membership.length < 2) {
    return NextResponse.json({ error: 'Both players must be in this league' }, { status: 400 });
  }

  // Check league is active
  const leagues = await sql`SELECT status FROM leagues WHERE id = ${leagueId}`;
  if (!leagues[0] || leagues[0].status !== 'active') {
    return NextResponse.json({ error: 'League is not active' }, { status: 400 });
  }

  await sql`
    INSERT INTO matches (league_id, player1_id, player2_id, submitted_by, score_player1, score_player2, played_at)
    VALUES (${leagueId}, ${session.user.id}, ${opponentId}, ${session.user.id}, ${myScore}, ${theirScore}, ${playedAt})
  `;

  return NextResponse.json({ success: true }, { status: 201 });
}
