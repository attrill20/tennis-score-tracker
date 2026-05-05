import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId, reason } = await req.json();

  if (!matchId || !reason?.trim()) {
    return NextResponse.json({ error: 'Match ID and reason are required' }, { status: 400 });
  }

  // Verify the user is one of the players in the match
  const matches = await sql`
    SELECT id, player1_id, player2_id, status FROM matches WHERE id = ${matchId}
  `;
  const match = matches[0];

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  if (match.player1_id !== session.user.id && match.player2_id !== session.user.id) {
    return NextResponse.json({ error: 'You are not a player in this match' }, { status: 403 });
  }

  if (match.status === 'disputed') {
    return NextResponse.json({ error: 'Match is already disputed' }, { status: 409 });
  }

  await sql`BEGIN`;
  try {
    await sql`UPDATE matches SET status = 'disputed' WHERE id = ${matchId}`;
    await sql`
      INSERT INTO disputes (match_id, raised_by, reason)
      VALUES (${matchId}, ${session.user.id}, ${reason.trim()})
    `;
    await sql`COMMIT`;
  } catch (e) {
    await sql`ROLLBACK`;
    throw e;
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
