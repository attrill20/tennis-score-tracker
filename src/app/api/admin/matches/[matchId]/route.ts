import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = session.user.role;
  if (role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { matchId } = await params;
  const matches = await sql`
    SELECT m.*, l.created_by AS league_created_by
    FROM matches m
    JOIN leagues l ON l.id = m.league_id
    WHERE m.id = ${matchId}
  `;
  const match = matches[0];
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  if (role !== 'super_admin' && match.league_created_by !== session.user.id) {
    return NextResponse.json({ error: 'You can only edit results in leagues you created' }, { status: 403 });
  }

  const { sets, tiebreaks, playedAt, matchType = 'normal', retiredPlayer, walkoverId } = await req.json();

  if (matchType !== 'walkover' && !playedAt) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  }
  if (!playedAt) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  }
  if (matchType === 'normal' && !sets?.length) {
    return NextResponse.json({ error: 'Set scores are required' }, { status: 400 });
  }

  let score1 = 0, score2 = 0;
  const editSets = (sets as [number, number][] | undefined) ?? [];
  if (matchType !== 'walkover' && editSets.length) {
    for (const [p1, p2] of editSets) {
      if (p1 > p2) score1++;
      else if (p2 > p1) score2++;
    }
  }

  const player1Id = match.player1_id as string;
  const player2Id = match.player2_id as string;
  let winnerId: string | null = null;
  if (matchType === 'walkover') {
    winnerId = walkoverId === 'me' ? player2Id : player1Id;
  } else if (matchType === 'retirement') {
    winnerId = retiredPlayer === 'me' ? player2Id : player1Id;
  }

  const editTiebreaks = tiebreaks as ([number, number] | null)[] | null;
  const hasEditTiebreak = editTiebreaks?.some((t) => t !== null) ?? false;

  await sql`
    UPDATE matches SET
      score_player1 = ${score1},
      score_player2 = ${score2},
      set_scores = ${matchType === 'walkover' ? null : JSON.stringify(editSets)},
      tiebreak_scores = ${hasEditTiebreak ? JSON.stringify(editTiebreaks) : null},
      played_at = ${playedAt},
      match_type = ${matchType},
      winner_id = ${winnerId},
      status = 'overridden',
      pending_score_player1 = NULL,
      pending_score_player2 = NULL,
      pending_set_scores = NULL,
      pending_tiebreak_scores = NULL,
      pending_match_type = NULL,
      pending_winner_id = NULL,
      pending_edit_by = NULL
    WHERE id = ${matchId}
  `;

  await sql`
    UPDATE disputes SET status = 'resolved', resolved_by = ${session.user.id}, resolved_at = NOW()
    WHERE match_id = ${matchId} AND status = 'open'
  `;

  return NextResponse.json({ success: true });
}
