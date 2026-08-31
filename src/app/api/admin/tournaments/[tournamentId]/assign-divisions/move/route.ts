import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { getCurrentRoundDivisions } from '@/lib/divisionDrafts';
import { findPlaceholderTournamentNameConflict } from '@/lib/placeholders';

export async function POST(req: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tournamentId } = await params;
  const { playerId, targetLeagueId } = await req.json();
  if (!playerId) {
    return NextResponse.json({ error: 'A player is required' }, { status: 400 });
  }

  const divisions = await getCurrentRoundDivisions(tournamentId);
  const divisionIds = divisions.map((d) => d.id);
  if (targetLeagueId && !divisionIds.includes(targetLeagueId)) {
    return NextResponse.json({ error: 'That division is not part of this round' }, { status: 400 });
  }
  if (divisionIds.length === 0) {
    return NextResponse.json({ error: 'This tournament has no current-round divisions' }, { status: 400 });
  }

  // If the player's currently paired, move (or unassign) their partner alongside them so a
  // pair never gets split across divisions by a single drag.
  const [existing] = divisionIds.length > 0
    ? await sql`SELECT league_id, partner_id FROM league_player_drafts WHERE league_id = ANY(${divisionIds}::uuid[]) AND player_id = ${playerId}`
    : [];
  const partnerId = existing?.partner_id as string | undefined;
  const idsToMove = partnerId ? [playerId, partnerId] : [playerId];

  if (targetLeagueId) {
    for (const id of idsToMove) {
      const conflict = await findPlaceholderTournamentNameConflict(id, tournamentId);
      if (conflict) {
        return NextResponse.json({
          error: `${conflict.fullName} is already in this tournament with the same name - rename one of them to tell them apart before adding.`,
        }, { status: 400 });
      }
    }
  }

  await sql`DELETE FROM league_player_drafts WHERE league_id = ANY(${divisionIds}::uuid[]) AND player_id = ANY(${idsToMove}::uuid[])`;

  if (targetLeagueId) {
    for (const id of idsToMove) {
      await sql`
        INSERT INTO league_player_drafts (league_id, player_id, partner_id)
        VALUES (${targetLeagueId}, ${id}, ${partnerId ? idsToMove.find((x) => x !== id) : null})
        ON CONFLICT (league_id, player_id) DO UPDATE SET partner_id = EXCLUDED.partner_id
      `;
    }
  }

  return NextResponse.json({ success: true });
}
