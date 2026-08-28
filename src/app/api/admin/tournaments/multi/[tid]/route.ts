import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { parsePointsConfig } from '@/lib/league';

const VALID_SCORING = ['1_set_tiebreak', '1_set_no_tiebreak', 'best_of_3_tiebreak', 'best_of_3_no_tiebreak', 'best_of_5_tiebreak', 'best_of_5_no_tiebreak'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tid: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tid } = await params;
  const body = await req.json();
  const { name, description, roundDates, finalEnd, numPromoted, numRelegated, maxRegistrations, scoringMethod, pointsConfig } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
  }
  if (!VALID_SCORING.includes(scoringMethod)) {
    return NextResponse.json({ error: 'Invalid scoring method' }, { status: 400 });
  }
  const resolvedPointsConfig = parsePointsConfig(pointsConfig);
  if (resolvedPointsConfig === 'invalid') {
    return NextResponse.json({ error: 'Invalid points scoring configuration' }, { status: 400 });
  }
  const pointsConfigToStore = resolvedPointsConfig ? JSON.stringify(resolvedPointsConfig) : null;

  const dates: string[] = Array.isArray(roundDates) ? roundDates.filter(Boolean) : [];
  if (dates.length < 1) {
    return NextResponse.json({ error: 'At least one round start date is required' }, { status: 400 });
  }
  if (!finalEnd) {
    return NextResponse.json({ error: 'A final finishing date is required' }, { status: 400 });
  }

  const sorted = [...dates].sort();
  const promoted = Number(numPromoted ?? 0);
  const relegated = Number(numRelegated ?? 0);

  const existing = await sql`SELECT format FROM tournaments WHERE id = ${tid}`;
  if (existing.length === 0) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }
  if (existing[0].format !== 'multi') {
    return NextResponse.json({ error: 'Only multi-league tournaments can be managed here' }, { status: 400 });
  }

  const cleanDescription = typeof description === 'string' && description.trim() !== '' ? description : null;

  let resolvedMaxRegistrations: number | null = null;
  if (maxRegistrations !== null && maxRegistrations !== undefined && maxRegistrations !== '') {
    const n = Number(maxRegistrations);
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json({ error: 'Maximum registrations must be a positive whole number' }, { status: 400 });
    }
    resolvedMaxRegistrations = n;
  }

  await sql`
    UPDATE tournaments
    SET name = ${name},
        description = ${cleanDescription},
        round_dates = ${sorted},
        num_rounds = ${sorted.length},
        final_end = ${finalEnd},
        num_promoted = ${promoted},
        num_relegated = ${relegated},
        max_registrations = ${resolvedMaxRegistrations},
        scoring_method = ${scoringMethod},
        points_config = ${pointsConfigToStore}
    WHERE id = ${tid}
  `;

  // Cascade the new schedule onto every existing division. A round runs from its start date
  // until the day before the next round (or the final date for the last round). Divisions whose
  // round no longer has a date keep their existing dates (guard avoids nulling a NOT NULL column).
  await sql`
    UPDATE leagues l
    SET season_start = t.round_dates[l.round_number],
        season_end = COALESCE(t.round_dates[l.round_number + 1] - 1, t.final_end)
    FROM tournaments t
    WHERE l.tournament_id = t.id
      AND t.id = ${tid}
      AND t.round_dates[l.round_number] IS NOT NULL
  `;

  // Scoring method and points config must stay consistent across every division and round.
  await sql`
    UPDATE leagues
    SET scoring_method = ${scoringMethod}, points_config = ${pointsConfigToStore}
    WHERE tournament_id = ${tid}
  `;

  // Keep the tournament status in step with its first round date.
  await sql`
    UPDATE tournaments
    SET status = CASE WHEN round_dates[1] > CURRENT_DATE THEN 'upcoming' ELSE 'active' END
    WHERE id = ${tid} AND status IN ('upcoming', 'active')
  `;

  // Keep current-round divisions in step with the tournament status.
  await sql`
    UPDATE leagues l
    SET status = t.status::league_status
    FROM tournaments t
    WHERE l.tournament_id = t.id
      AND t.id = ${tid}
      AND t.status IN ('upcoming', 'active')
      AND l.status IN ('upcoming', 'active')
      AND l.round_number = (SELECT MAX(round_number) FROM leagues WHERE tournament_id = ${tid})
  `;

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ tid: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tid } = await params;

  // Remove everything belonging to the tournament: disputes, matches, division memberships,
  // the divisions themselves, then the tournament.
  await sql`DELETE FROM disputes WHERE match_id IN (
    SELECT m.id FROM matches m JOIN leagues l ON l.id = m.league_id WHERE l.tournament_id = ${tid}
  )`;
  await sql`DELETE FROM matches WHERE league_id IN (SELECT id FROM leagues WHERE tournament_id = ${tid})`;
  await sql`DELETE FROM league_players WHERE league_id IN (SELECT id FROM leagues WHERE tournament_id = ${tid})`;
  await sql`DELETE FROM leagues WHERE tournament_id = ${tid}`;
  await sql`DELETE FROM tournaments WHERE id = ${tid}`;

  return NextResponse.json({ ok: true });
}
