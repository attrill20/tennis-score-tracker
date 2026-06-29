import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { leagueId, opponentId, player3Id, player4Id, sets, tiebreaks, playedAt, matchType = 'normal', retiredPlayer, walkoverId } = await req.json();

  if (!leagueId || !opponentId || !playedAt) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }
  if (matchType === 'normal' && !sets?.length) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }
  if (matchType === 'retirement' && !retiredPlayer) {
    return NextResponse.json({ error: 'Please specify who retired' }, { status: 400 });
  }

  const isDoubles = !!(player3Id && player4Id);

  if (isDoubles) {
    const allIds = [session.user.id, player3Id, opponentId, player4Id];
    if (new Set(allIds).size < 4) {
      return NextResponse.json({ error: 'All four players must be different' }, { status: 400 });
    }
  }

  let myScore = 0, theirScore = 0;
  if (sets?.length) {
    for (const [p1, p2] of sets) {
      if (p1 > p2) myScore++;
      else if (p2 > p1) theirScore++;
    }
  }

  // Determine winner_id for non-normal match types
  let winnerIdToStore: string | null = null;
  if (matchType === 'walkover') {
    winnerIdToStore = walkoverId === 'me' ? opponentId : session.user.id;
  } else if (matchType === 'retirement') {
    winnerIdToStore = retiredPlayer === 'me' ? opponentId : session.user.id;
  }

  // Verify all players are in the league
  const playerIds = isDoubles
    ? [session.user.id, opponentId, player3Id, player4Id]
    : [session.user.id, opponentId];

  const membership = await sql`
    SELECT player_id FROM league_players
    WHERE league_id = ${leagueId}
    AND player_id = ANY(${playerIds}::uuid[])
  `;

  if (membership.length < playerIds.length) {
    return NextResponse.json({ error: isDoubles ? 'All four players must be in this league' : 'Both players must be in this league' }, { status: 400 });
  }

  // Check the division is active (or its parent tournament is) and the end date hasn't passed.
  const leagues = await sql`
    SELECT l.status, l.season_end, t.status AS tournament_status
    FROM leagues l LEFT JOIN tournaments t ON t.id = l.tournament_id
    WHERE l.id = ${leagueId}
  `;
  const league = leagues[0];
  const divisionActive = !!league && (league.status === 'active' || (league.status === 'upcoming' && league.tournament_status === 'active'));
  if (!divisionActive) {
    return NextResponse.json({ error: 'Tournament is not active' }, { status: 400 });
  }
  if (new Date(league.season_end as string) < new Date(new Date().toDateString())) {
    return NextResponse.json({ error: 'The league season has ended - no more scores can be submitted' }, { status: 400 });
  }

  const hasTiebreak = Array.isArray(tiebreaks) && tiebreaks.some((t: unknown) => t !== null);
  const setsToStore = sets?.length ? JSON.stringify(sets) : null;

  if (isDoubles) {
    await sql`
      INSERT INTO matches (league_id, player1_id, player2_id, player3_id, player4_id, submitted_by, score_player1, score_player2, set_scores, tiebreak_scores, played_at, match_type, winner_id)
      VALUES (${leagueId}, ${session.user.id}, ${opponentId}, ${player3Id}, ${player4Id}, ${session.user.id}, ${myScore}, ${theirScore}, ${setsToStore}, ${hasTiebreak ? JSON.stringify(tiebreaks) : null}, ${playedAt}, ${matchType}, ${winnerIdToStore})
    `;
  } else {
    await sql`
      INSERT INTO matches (league_id, player1_id, player2_id, submitted_by, score_player1, score_player2, set_scores, tiebreak_scores, played_at, match_type, winner_id)
      VALUES (${leagueId}, ${session.user.id}, ${opponentId}, ${session.user.id}, ${myScore}, ${theirScore}, ${setsToStore}, ${hasTiebreak ? JSON.stringify(tiebreaks) : null}, ${playedAt}, ${matchType}, ${winnerIdToStore})
    `;
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
