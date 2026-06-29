import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

const VALID_SCORING = ['1_set_tiebreak', '1_set_no_tiebreak', 'best_of_3_tiebreak', 'best_of_3_no_tiebreak', 'best_of_5_tiebreak', 'best_of_5_no_tiebreak'];
const VALID_TIEBREAKERS = ['head_to_head', 'most_sets_won', 'set_difference'];
const VALID_COLORS = ['blue', 'purple', 'orange', 'pink', 'teal', 'indigo', 'cyan', 'rose', 'yellow', 'green', 'lime', 'violet', 'amber', 'sky'];

function dayBefore(dateStr: string): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

function statusForStart(startDate: string): 'upcoming' | 'active' {
  const today = new Date().toISOString().split('T')[0];
  return startDate > today ? 'upcoming' : 'active';
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const {
    format,
    name,
    scoringMethod,
    tiebreaker,
    leagueType,
    isPublic,
    joinType,
    description,
    color,
    maxPlayers,
    numPromoted,
    numRelegated,
  } = body;

  if (!name) {
    return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
  }

  const playerCount = Number(maxPlayers);
  if (playerCount < 2 || playerCount > 12 || !Number.isInteger(playerCount)) {
    return NextResponse.json({ error: 'Players per division must be between 2 and 12' }, { status: 400 });
  }
  if (!VALID_SCORING.includes(scoringMethod)) {
    return NextResponse.json({ error: 'Invalid scoring method' }, { status: 400 });
  }

  const resolvedTiebreaker = VALID_TIEBREAKERS.includes(tiebreaker) ? tiebreaker : 'set_difference';
  const resolvedJoinType = joinType === 'open_invite' ? 'open_invite' : 'invite_only';
  const resolvedLeagueType = leagueType === 'doubles' ? 'doubles' : 'singles';
  const resolvedColor = VALID_COLORS.includes(color) ? color : VALID_COLORS[Math.floor(Math.random() * VALID_COLORS.length)];
  const promoted = Number(numPromoted ?? 0);
  const relegated = Number(numRelegated ?? 0);
  const isPub = isPublic !== false;

  if (format === 'multi') {
    const numDivisions = Number(body.numDivisions);
    const roundDates: string[] = Array.isArray(body.roundDates) ? body.roundDates.filter(Boolean) : [];
    const finalEnd: string = body.finalEnd;

    if (!Number.isInteger(numDivisions) || numDivisions < 2 || numDivisions > 8) {
      return NextResponse.json({ error: 'Number of divisions must be between 2 and 8' }, { status: 400 });
    }
    if (roundDates.length < 1) {
      return NextResponse.json({ error: 'At least one round start date is required' }, { status: 400 });
    }
    if (!finalEnd) {
      return NextResponse.json({ error: 'A final finishing date is required' }, { status: 400 });
    }
    if (promoted + relegated > playerCount) {
      return NextResponse.json({ error: 'Promoted + relegated cannot exceed players per division' }, { status: 400 });
    }

    const sortedRounds = [...roundDates].sort();

    const [{ id: tournamentId }] = await sql`
      INSERT INTO tournaments (name, format, status, num_divisions, num_promoted, num_relegated, num_rounds, final_end, round_dates, is_public, color, description, created_by)
      VALUES (${name}, 'multi', ${statusForStart(sortedRounds[0])}, ${numDivisions}, ${promoted}, ${relegated}, ${sortedRounds.length}, ${finalEnd}, ${sortedRounds}, ${isPub}, ${resolvedColor}, ${description ?? null}, ${session.user.id})
      RETURNING id
    `;

    // Round 1 ends the day before round 2 starts (or at the final date if it's the only round).
    const round1Start = sortedRounds[0];
    const round1End = sortedRounds.length > 1 ? dayBefore(sortedRounds[1]) : finalEnd;
    const round1Status = statusForStart(round1Start);

    const divisions = [];
    for (let i = 0; i < numDivisions; i++) {
      const order = i + 1;
      const divName = `Division ${order}`;
      const [div] = await sql`
        INSERT INTO leagues (name, season_start, season_end, status, max_players, scoring_method, num_promoted, num_relegated, tiebreaker, created_by, is_public, join_type, description, league_type, color, tournament_id, round_number, division_order)
        VALUES (${divName}, ${round1Start}, ${round1End}, ${round1Status}, ${playerCount}, ${scoringMethod}, ${promoted}, ${relegated}, ${resolvedTiebreaker}, ${session.user.id}, ${isPub}, 'invite_only', ${null}, ${resolvedLeagueType}, ${resolvedColor}, ${tournamentId}, 1, ${order})
        RETURNING id
      `;
      divisions.push({ id: div.id as string, name: divName, order });
    }

    return NextResponse.json({ tournamentId, format: 'multi', divisions }, { status: 201 });
  }

  // ── Single-division tournament (the classic league) ──
  const { startDate, endDate, status } = body;
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 });
  }

  const [{ id: tournamentId }] = await sql`
    INSERT INTO tournaments (name, format, status, num_divisions, num_promoted, num_relegated, num_rounds, final_end, is_public, color, description, created_by)
    VALUES (${name}, 'single', ${status ?? statusForStart(startDate)}, 1, ${promoted}, ${relegated}, 1, ${endDate}, ${isPub}, ${resolvedColor}, ${description ?? null}, ${session.user.id})
    RETURNING id
  `;

  const [div] = await sql`
    INSERT INTO leagues (name, season_start, season_end, status, max_players, scoring_method, num_promoted, num_relegated, tiebreaker, created_by, is_public, join_type, description, league_type, color, tournament_id, round_number, division_order)
    VALUES (${name}, ${startDate}, ${endDate}, ${status ?? statusForStart(startDate)}, ${playerCount}, ${scoringMethod}, ${promoted}, ${relegated}, ${resolvedTiebreaker}, ${session.user.id}, ${isPub}, ${resolvedJoinType}, ${description ?? null}, ${resolvedLeagueType}, ${resolvedColor}, ${tournamentId}, 1, 1)
    RETURNING id
  `;

  return NextResponse.json({ tournamentId, format: 'single', divisions: [{ id: div.id as string, name, order: 1 }] }, { status: 201 });
}
