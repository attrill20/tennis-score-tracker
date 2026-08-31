import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { getCurrentRoundDivisions } from '@/lib/divisionDrafts';

export async function GET(_req: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tournamentId } = await params;

  const [tournament] = await sql`SELECT format FROM tournaments WHERE id = ${tournamentId}`;
  if (!tournament || tournament.format !== 'multi') {
    return NextResponse.json({ error: 'Not a multi-format tournament' }, { status: 400 });
  }

  const divisions = await getCurrentRoundDivisions(tournamentId);
  const divisionIds = divisions.map((d) => d.id);

  const [registrations, drafts, players] = await Promise.all([
    sql`
      SELECT r.id, r.player_id, (p.first_name || ' ' || p.last_name) AS full_name,
        r.ability_level, r.answers
      FROM tournament_registrations r
      JOIN profiles p ON p.id = r.player_id
      WHERE r.tournament_id = ${tournamentId}
      ORDER BY p.last_name, p.first_name
    `,
    divisionIds.length > 0
      ? sql`SELECT league_id, player_id, partner_id, confirmed FROM league_player_drafts WHERE league_id = ANY(${divisionIds}::uuid[])`
      : Promise.resolve([]),
    // Every club member (and placeholder) who could plausibly be added to a division here,
    // not just those who filled in the registration form - same picker source as the
    // per-league assign-players panel.
    sql`
      SELECT id, (first_name || ' ' || last_name) AS full_name, is_placeholder, placeholder_alias, placeholder_anonymized,
        role = 'unverified' AS is_unverified
      FROM profiles
      WHERE deleted_at IS NULL
        AND email != 'qptcscoreadmin@gmail.com'
      ORDER BY first_name, last_name
    `,
  ]);

  return NextResponse.json({ divisions, registrations, drafts, players });
}
