import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = session.user.role;
  if (role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { leagueId, player1Id, player2Id, player3Id, player4Id, sets, tiebreaks, playedAt, matchType = 'normal', retiredPlayer, walkoverId } = await req.json();

  if (!leagueId || !player1Id || !player2Id || !playedAt) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }
  if (player1Id === player2Id) {
    return NextResponse.json({ error: 'Players must be different' }, { status: 400 });
  }

  const isDoubles = !!(player3Id && player4Id);
  if (matchType === 'normal' && !sets?.length) {
    return NextResponse.json({ error: 'Set scores are required' }, { status: 400 });
  }
  if (matchType === 'retirement' && !retiredPlayer) {
    return NextResponse.json({ error: 'Please specify who retired' }, { status: 400 });
  }

  if (role !== 'super_admin') {
    const leagues = await sql`SELECT created_by FROM leagues WHERE id = ${leagueId}`;
    if (!leagues[0] || leagues[0].created_by !== session.user.id) {
      return NextResponse.json({ error: 'You can only add results to leagues you created' }, { status: 403 });
    }
  }

  const requiredIds = isDoubles
    ? [player1Id, player2Id, player3Id, player4Id]
    : [player1Id, player2Id];
  const membership = await sql`
    SELECT player_id FROM league_players
    WHERE league_id = ${leagueId}
    AND player_id = ANY(${requiredIds}::uuid[])
  `;
  if (membership.length < requiredIds.length) {
    return NextResponse.json({ error: isDoubles ? 'All four players must be in this league' : 'Both players must be in this league' }, { status: 400 });
  }

  let score1 = 0, score2 = 0;
  if (sets?.length) {
    for (const [p1, p2] of sets as [number, number][]) {
      if (p1 > p2) score1++;
      else if (p2 > p1) score2++;
    }
  }

  // walkoverId/retiredPlayer === 'me' means player1 didn't appear/retired → player2 won
  // walkoverId/retiredPlayer === 'them' means player2 didn't appear/retired → player1 won
  let winnerId: string | null = null;
  if (matchType === 'walkover') {
    winnerId = walkoverId === 'me' ? player2Id : player1Id;
  } else if (matchType === 'retirement') {
    winnerId = retiredPlayer === 'me' ? player2Id : player1Id;
  }

  const hasTiebreak = Array.isArray(tiebreaks) && tiebreaks.some((t: unknown) => t !== null);
  const setsToStore = sets?.length ? JSON.stringify(sets) : null;

  if (isDoubles) {
    await sql`
      INSERT INTO matches (league_id, player1_id, player2_id, player3_id, player4_id, submitted_by, score_player1, score_player2, set_scores, tiebreak_scores, played_at, match_type, winner_id, status)
      VALUES (${leagueId}, ${player1Id}, ${player2Id}, ${player3Id}, ${player4Id}, ${session.user.id}, ${score1}, ${score2}, ${setsToStore}, ${hasTiebreak ? JSON.stringify(tiebreaks) : null}, ${playedAt}, ${matchType}, ${winnerId}, 'confirmed')
    `;
  } else {
    await sql`
      INSERT INTO matches (league_id, player1_id, player2_id, submitted_by, score_player1, score_player2, set_scores, tiebreak_scores, played_at, match_type, winner_id, status)
      VALUES (${leagueId}, ${player1Id}, ${player2Id}, ${session.user.id}, ${score1}, ${score2}, ${setsToStore}, ${hasTiebreak ? JSON.stringify(tiebreaks) : null}, ${playedAt}, ${matchType}, ${winnerId}, 'confirmed')
    `;
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
