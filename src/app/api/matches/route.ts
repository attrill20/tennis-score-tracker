import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { leagueId, opponentId, sets, tiebreaks, playedAt } = await req.json();

  if (!leagueId || !opponentId || !sets?.length || !playedAt) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  let myScore = 0, theirScore = 0;
  for (const [p1, p2] of sets) {
    if (p1 > p2) myScore++;
    else if (p2 > p1) theirScore++;
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

  // Check league is active and end date hasn't passed
  const leagues = await sql`SELECT status, season_end FROM leagues WHERE id = ${leagueId}`;
  const league = leagues[0];
  if (!league || league.status !== 'active') {
    return NextResponse.json({ error: 'League is not active' }, { status: 400 });
  }
  if (new Date(league.season_end as string) < new Date(new Date().toDateString())) {
    return NextResponse.json({ error: 'The league season has ended - no more scores can be submitted' }, { status: 400 });
  }

  const hasTiebreak = Array.isArray(tiebreaks) && tiebreaks.some((t: unknown) => t !== null);

  await sql`
    INSERT INTO matches (league_id, player1_id, player2_id, submitted_by, score_player1, score_player2, set_scores, tiebreak_scores, played_at)
    VALUES (${leagueId}, ${session.user.id}, ${opponentId}, ${session.user.id}, ${myScore}, ${theirScore}, ${JSON.stringify(sets)}, ${hasTiebreak ? JSON.stringify(tiebreaks) : null}, ${playedAt})
  `;

  return NextResponse.json({ success: true }, { status: 201 });
}
