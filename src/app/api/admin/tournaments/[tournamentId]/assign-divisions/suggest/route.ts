import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { getCurrentRoundDivisions } from '@/lib/divisionDrafts';
import { computeSuggestedDivisions, type AbilityLevel } from '@/lib/registration';

export async function POST(_req: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tournamentId } = await params;

  const divisions = await getCurrentRoundDivisions(tournamentId);
  if (divisions.length === 0) {
    return NextResponse.json({ error: 'This tournament has no current-round divisions' }, { status: 400 });
  }
  const divisionIds = divisions.map((d) => d.id);

  const registrations = (await sql`
    SELECT id, player_id, ability_level, answers FROM tournament_registrations WHERE tournament_id = ${tournamentId}
  `) as unknown as { id: string; player_id: string; ability_level: AbilityLevel; answers: Record<string, string> | null }[];

  const suggestion = computeSuggestedDivisions(
    registrations.map((r) => ({
      id: r.id,
      ability_level: r.ability_level,
      previous_division: r.answers?.previous_division ?? null,
    })),
    divisions.length
  );

  // Snapshot the current arrangement first so the client can offer an "Undo auto-allocate"
  // that restores exactly this, including any manual moves/pairings/confirmations.
  const previousDrafts = await sql`
    SELECT league_id, player_id, partner_id, confirmed FROM league_player_drafts WHERE league_id = ANY(${divisionIds}::uuid[])
  `;

  await sql`BEGIN`;
  try {
    await sql`DELETE FROM league_player_drafts WHERE league_id = ANY(${divisionIds}::uuid[])`;
    for (const registration of registrations) {
      const divisionNumber = suggestion.get(registration.id);
      if (!divisionNumber) continue;
      const leagueId = divisions[divisionNumber - 1]?.id;
      if (!leagueId) continue;
      await sql`
        INSERT INTO league_player_drafts (league_id, player_id)
        VALUES (${leagueId}, ${registration.player_id})
        ON CONFLICT (league_id, player_id) DO NOTHING
      `;
    }
    await sql`COMMIT`;
  } catch (e) {
    await sql`ROLLBACK`;
    throw e;
  }

  return NextResponse.json({ success: true, previousDrafts });
}
