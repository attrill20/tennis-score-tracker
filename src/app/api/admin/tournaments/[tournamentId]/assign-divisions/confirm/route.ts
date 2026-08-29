import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { getCurrentRoundDivisions } from '@/lib/divisionDrafts';

export async function POST(_req: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tournamentId } = await params;
  const divisions = await getCurrentRoundDivisions(tournamentId);
  const divisionIds = divisions.map((d) => d.id);
  if (divisionIds.length === 0) {
    return NextResponse.json({ error: 'This tournament has no current-round divisions' }, { status: 400 });
  }

  await sql`UPDATE league_player_drafts SET confirmed = true WHERE league_id = ANY(${divisionIds}::uuid[])`;

  return NextResponse.json({ success: true });
}
