import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: leagueId } = await params;
  const { promoted, relegated, standings } = await req.json();

  // Assign final_position based on standings order
  for (let i = 0; i < standings.length; i++) {
    const playerId = standings[i];
    await sql`
      UPDATE league_players
      SET final_position = ${i + 1}
      WHERE league_id = ${leagueId} AND player_id = ${playerId}
    `;
  }

  // Mark league as completed
  await sql`UPDATE leagues SET status = 'completed' WHERE id = ${leagueId}`;

  return NextResponse.json({ success: true, promoted, relegated });
}
