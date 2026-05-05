import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: disputeId } = await params;
  const { matchId, override, score_player1, score_player2 } = await req.json();

  if (override) {
    if (score_player1 === undefined || score_player2 === undefined) {
      return NextResponse.json({ error: 'Scores required for override' }, { status: 400 });
    }
    if (score_player1 === score_player2) {
      return NextResponse.json({ error: 'Scores cannot be a draw' }, { status: 400 });
    }
    await sql`
      UPDATE matches
      SET score_player1 = ${score_player1}, score_player2 = ${score_player2}, status = 'overridden'
      WHERE id = ${matchId}
    `;
  } else {
    await sql`UPDATE matches SET status = 'confirmed' WHERE id = ${matchId}`;
  }

  await sql`
    UPDATE disputes
    SET status = 'resolved', resolved_by = ${session.user.id}, resolved_at = NOW()
    WHERE id = ${disputeId}
  `;

  return NextResponse.json({ success: true });
}
