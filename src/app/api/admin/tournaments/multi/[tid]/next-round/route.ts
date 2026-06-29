import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { generateNextRound } from '@/lib/tournament';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ tid: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tid } = await params;
  const [{ current_round }] = await sql`
    SELECT COALESCE(MAX(round_number), 1) AS current_round FROM leagues WHERE tournament_id = ${tid}
  `;

  const created = await generateNextRound(tid, Number(current_round));
  if (created.length === 0) {
    return NextResponse.json({ error: 'No next round to generate (already generated, or this is the final round).' }, { status: 400 });
  }

  return NextResponse.json({ created: created.length, round: Number(current_round) + 1 });
}
