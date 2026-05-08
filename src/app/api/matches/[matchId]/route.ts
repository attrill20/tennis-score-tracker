import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId } = await params;
  const { myScore, theirScore, playedAt } = await req.json();

  if (myScore === undefined || theirScore === undefined || !playedAt) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  if (myScore === theirScore) {
    return NextResponse.json({ error: 'Scores cannot be a draw' }, { status: 400 });
  }

  const matches = await sql`SELECT * FROM matches WHERE id = ${matchId}`;
  const match = matches[0];

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  if (match.submitted_by !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (match.status !== 'confirmed') return NextResponse.json({ error: 'Only confirmed matches can be edited' }, { status: 400 });

  await sql`
    UPDATE matches
    SET score_player1 = ${myScore}, score_player2 = ${theirScore}, played_at = ${playedAt}
    WHERE id = ${matchId}
  `;

  return NextResponse.json({ success: true });
}
