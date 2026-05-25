import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: disputeId } = await params;

  const rows = await sql`
    SELECT d.id, m.player1_id, m.player2_id
    FROM disputes d
    JOIN matches m ON m.id = d.match_id
    WHERE d.id = ${disputeId} AND d.status = 'resolved'
  `;
  const dispute = rows[0];
  if (!dispute) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const userId = session.user.id;

  if (dispute.player1_id === userId) {
    await sql`UPDATE disputes SET acknowledged_by_player1 = true WHERE id = ${disputeId}`;
  } else if (dispute.player2_id === userId) {
    await sql`UPDATE disputes SET acknowledged_by_player2 = true WHERE id = ${disputeId}`;
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
