import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const body = await req.json();

  const matches = await sql`SELECT * FROM matches WHERE id = ${matchId}`;
  const match = matches[0];
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  const userId = session.user.id;
  const isSubmitter = match.submitted_by === userId;
  const isOpponent = (match.player1_id === userId || match.player2_id === userId) && !isSubmitter;

  const { action } = body;

  // Opponent dismisses the "new match" notification
  if (action === 'seen-by-opponent') {
    if (match.player2_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await sql`UPDATE matches SET opponent_seen = true WHERE id = ${matchId}`;
    return NextResponse.json({ success: true });
  }

  // Non-submitter proposes a correction
  if (action === 'suggest-edit') {
    if (!isOpponent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (match.status !== 'confirmed') return NextResponse.json({ error: 'Match cannot be edited' }, { status: 400 });

    const { sets, tiebreaks, playedAt, matchType = 'normal', walkoverId, retiredPlayer } = body;

    if (matchType !== 'walkover' && (!sets?.length || !playedAt)) {
      return NextResponse.json({ error: 'Sets and date are required' }, { status: 400 });
    }
    if (!playedAt) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    // Sets arrive as [my, their] from the suggester's perspective.
    // If the suggester is player1, [my, their] = [p1, p2] — no flip needed.
    // If the suggester is player2, [my, their] = [p2, p1] — flip to [p1, p2].
    const suggesterIsPlayer1 = match.player1_id === userId;
    const rawSets = (sets as [number, number][] | undefined) ?? [];
    const pendingSets = matchType === 'walkover'
      ? null
      : suggesterIsPlayer1
        ? rawSets
        : rawSets.map(([my, their]) => [their, my] as [number, number]);

    const rawTiebreaks = tiebreaks as ([number, number] | null)[] | null;
    const pendingTiebreaks = rawTiebreaks
      ? rawTiebreaks.map((tb) => tb
          ? (suggesterIsPlayer1 ? tb : [tb[1], tb[0]] as [number, number])
          : null)
      : null;
    const hasPendingTiebreak = pendingTiebreaks?.some((t) => t !== null) ?? false;

    let p1Score = 0, p2Score = 0;
    if (matchType !== 'walkover' && pendingSets) {
      for (const [p1, p2] of pendingSets as [number, number][]) {
        if (p1 > p2) p1Score++;
        else if (p2 > p1) p2Score++;
      }
    }

    // Determine pending winner for walkover/retirement
    const opponentId = suggesterIsPlayer1 ? match.player2_id as string : match.player1_id as string;
    let pendingWinnerId: string | null = null;
    if (matchType === 'walkover') {
      pendingWinnerId = walkoverId === 'them' ? userId : opponentId;
    } else if (matchType === 'retirement') {
      pendingWinnerId = retiredPlayer === 'them' ? userId : opponentId;
    }

    await sql`
      UPDATE matches SET
        status = 'pending_edit',
        pending_score_player1 = ${p1Score},
        pending_score_player2 = ${p2Score},
        pending_set_scores = ${pendingSets ? JSON.stringify(pendingSets) : null},
        pending_tiebreak_scores = ${hasPendingTiebreak ? JSON.stringify(pendingTiebreaks) : null},
        pending_match_type = ${matchType},
        pending_winner_id = ${pendingWinnerId},
        pending_edit_by = ${userId}
      WHERE id = ${matchId}
    `;

    return NextResponse.json({ success: true });
  }

  // Submitter accepts the proposed edit
  if (action === 'accept-edit') {
    if (!isSubmitter) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (match.status !== 'pending_edit') return NextResponse.json({ error: 'No pending edit' }, { status: 400 });

    await sql`
      UPDATE matches SET
        score_player1 = pending_score_player1,
        score_player2 = pending_score_player2,
        set_scores = pending_set_scores,
        tiebreak_scores = pending_tiebreak_scores,
        match_type = COALESCE(pending_match_type, match_type),
        winner_id = pending_winner_id,
        status = 'confirmed',
        pending_score_player1 = NULL,
        pending_score_player2 = NULL,
        pending_set_scores = NULL,
        pending_tiebreak_scores = NULL,
        pending_match_type = NULL,
        pending_winner_id = NULL,
        pending_edit_by = NULL
      WHERE id = ${matchId}
    `;

    return NextResponse.json({ success: true });
  }

  // Submitter declines the proposed edit — raises a dispute for admin to resolve
  if (action === 'decline-edit') {
    if (!isSubmitter) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (match.status !== 'pending_edit') return NextResponse.json({ error: 'No pending edit' }, { status: 400 });

    const opponentId = match.pending_edit_by;
    const reqP1 = match.pending_score_player1 as number;
    const reqP2 = match.pending_score_player2 as number;
    const reqSets = match.pending_set_scores ?? null;

    await sql`BEGIN`;
    try {
      const reqTiebreaks = match.pending_tiebreak_scores ?? null;
      await sql`
        UPDATE matches SET
          status = 'disputed',
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
        INSERT INTO disputes (match_id, raised_by, reason, requested_score_player1, requested_score_player2, requested_set_scores, requested_tiebreak_scores)
        VALUES (${matchId}, ${opponentId}, 'Score correction requested but declined by submitter',
                ${reqP1}, ${reqP2}, ${reqSets ? JSON.stringify(reqSets) : null}, ${reqTiebreaks ? JSON.stringify(reqTiebreaks) : null})
      `;
      await sql`COMMIT`;
    } catch (e) {
      await sql`ROLLBACK`;
      throw e;
    }

    return NextResponse.json({ success: true });
  }

  // Default: submitter editing their own confirmed match
  if (!isSubmitter) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (match.status !== 'confirmed') return NextResponse.json({ error: 'Only confirmed matches can be edited' }, { status: 400 });

  const { sets, tiebreaks, playedAt, matchType = 'normal', walkoverId, retiredPlayer } = body;

  if (matchType !== 'walkover' && (!sets?.length || !playedAt)) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }
  if (!playedAt) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  }

  let myScore = 0, theirScore = 0;
  const editSets = (sets as [number, number][] | undefined) ?? [];
  if (matchType !== 'walkover') {
    for (const [p1, p2] of editSets) {
      if (p1 > p2) myScore++;
      else if (p2 > p1) theirScore++;
    }
  }

  // Submitter is always player1; determine winner_id for walkover/retirement
  let editWinnerId: string | null = null;
  if (matchType === 'walkover') {
    editWinnerId = walkoverId === 'them' ? userId : match.player2_id as string;
  } else if (matchType === 'retirement') {
    editWinnerId = retiredPlayer === 'them' ? userId : match.player2_id as string;
  }

  const editTiebreaks = tiebreaks as ([number, number] | null)[] | null;
  const hasEditTiebreak = editTiebreaks?.some((t) => t !== null) ?? false;

  await sql`
    UPDATE matches
    SET score_player1 = ${myScore},
        score_player2 = ${theirScore},
        set_scores = ${matchType === 'walkover' ? null : JSON.stringify(editSets)},
        tiebreak_scores = ${hasEditTiebreak ? JSON.stringify(editTiebreaks) : null},
        played_at = ${playedAt},
        match_type = ${matchType},
        winner_id = ${editWinnerId}
    WHERE id = ${matchId}
  `;

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;

  const matches = await sql`SELECT submitted_by, league_id FROM matches WHERE id = ${matchId}`;
  const match = matches[0];
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  if (match.submitted_by !== session.user.id) {
    return NextResponse.json({ error: 'Only the match submitter can delete it' }, { status: 403 });
  }

  await sql`DELETE FROM disputes WHERE match_id = ${matchId}`;
  await sql`DELETE FROM matches WHERE id = ${matchId}`;

  return NextResponse.json({ success: true });
}
