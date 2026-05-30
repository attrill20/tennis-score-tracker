import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: leagueId } = await params;

  const rows = await sql`
    SELECT lp.user_archived, l.status
    FROM league_players lp
    JOIN leagues l ON l.id = lp.league_id
    WHERE lp.league_id = ${leagueId} AND lp.player_id = ${session.user.id}
  `;

  if (!rows[0]) return NextResponse.json({ error: 'You are not a member of this league' }, { status: 403 });
  if (rows[0].status !== 'completed' && rows[0].status !== 'archived') {
    return NextResponse.json({ error: 'Only completed leagues can be archived' }, { status: 400 });
  }

  await sql`
    UPDATE league_players SET user_archived = true
    WHERE league_id = ${leagueId} AND player_id = ${session.user.id}
  `;

  return NextResponse.json({ success: true });
}
