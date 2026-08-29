import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { getCurrentRoundDivisions } from '@/lib/divisionDrafts';

type DraftSnapshotRow = { league_id: string; player_id: string; partner_id: string | null; confirmed: boolean };

/**
 * Replaces the current round's draft arrangement wholesale with a given snapshot - used to
 * undo an auto-allocate ("suggest" returns the pre-allocation snapshot for exactly this).
 */
export async function POST(req: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tournamentId } = await params;
  const { drafts } = await req.json();
  if (!Array.isArray(drafts)) {
    return NextResponse.json({ error: 'A draft snapshot is required' }, { status: 400 });
  }

  const divisions = await getCurrentRoundDivisions(tournamentId);
  const divisionIds = divisions.map((d) => d.id);
  if (divisionIds.length === 0) {
    return NextResponse.json({ error: 'This tournament has no current-round divisions' }, { status: 400 });
  }

  // Only ever restore rows that belong to this round, in case of a stale/tampered snapshot.
  const rows = (drafts as DraftSnapshotRow[]).filter((d) => divisionIds.includes(d.league_id));

  await sql`BEGIN`;
  try {
    await sql`DELETE FROM league_player_drafts WHERE league_id = ANY(${divisionIds}::uuid[])`;
    for (const row of rows) {
      await sql`
        INSERT INTO league_player_drafts (league_id, player_id, partner_id, confirmed)
        VALUES (${row.league_id}, ${row.player_id}, ${row.partner_id}, ${row.confirmed})
        ON CONFLICT (league_id, player_id) DO UPDATE SET partner_id = ${row.partner_id}, confirmed = ${row.confirmed}
      `;
    }
    await sql`COMMIT`;
  } catch (e) {
    await sql`ROLLBACK`;
    throw e;
  }

  return NextResponse.json({ success: true });
}
