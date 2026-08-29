import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { getCurrentRoundDivisions } from '@/lib/divisionDrafts';

export async function POST(req: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tournamentId } = await params;
  const { leagueId, p1Id, p2Id } = await req.json();
  if (!leagueId || !p1Id || p1Id === p2Id) {
    return NextResponse.json({ error: 'A player is required' }, { status: 400 });
  }

  const divisions = await getCurrentRoundDivisions(tournamentId);
  const division = divisions.find((d) => d.id === leagueId);
  if (!division) {
    return NextResponse.json({ error: 'That division is not part of this round' }, { status: 400 });
  }
  if (division.league_type !== 'doubles') {
    return NextResponse.json({ error: 'Pairing only applies to doubles divisions' }, { status: 400 });
  }

  // p2Id === null unpairs p1Id (and whoever it was previously paired with, if anyone).
  if (!p2Id) {
    const [current] = await sql`SELECT partner_id FROM league_player_drafts WHERE league_id = ${leagueId} AND player_id = ${p1Id}`;
    const previousPartner = current?.partner_id as string | null;
    await sql`UPDATE league_player_drafts SET partner_id = NULL WHERE league_id = ${leagueId} AND player_id = ${p1Id}`;
    if (previousPartner) {
      await sql`UPDATE league_player_drafts SET partner_id = NULL WHERE league_id = ${leagueId} AND player_id = ${previousPartner}`;
    }
    return NextResponse.json({ success: true });
  }

  await sql`
    INSERT INTO league_player_drafts (league_id, player_id, partner_id)
    VALUES (${leagueId}, ${p1Id}, ${p2Id})
    ON CONFLICT (league_id, player_id) DO UPDATE SET partner_id = ${p2Id}
  `;
  await sql`
    INSERT INTO league_player_drafts (league_id, player_id, partner_id)
    VALUES (${leagueId}, ${p2Id}, ${p1Id})
    ON CONFLICT (league_id, player_id) DO UPDATE SET partner_id = ${p1Id}
  `;

  return NextResponse.json({ success: true });
}
