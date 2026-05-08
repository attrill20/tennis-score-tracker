import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Return league players the requesting user hasn't played yet
  const players = await sql`
    SELECT p.id, (p.first_name || ' ' || p.last_name) AS full_name
    FROM profiles p
    JOIN league_players lp ON lp.player_id = p.id
    WHERE lp.league_id = ${id}
    AND p.id != ${session.user.id}
    AND NOT EXISTS (
      SELECT 1 FROM matches m
      WHERE m.league_id = ${id}
      AND m.status != 'disputed'
      AND (
        (m.player1_id = ${session.user.id} AND m.player2_id = p.id)
        OR
        (m.player2_id = ${session.user.id} AND m.player1_id = p.id)
      )
    )
    ORDER BY p.last_name, p.first_name
  `;

  return NextResponse.json({ players });
}
