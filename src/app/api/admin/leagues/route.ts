import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, startDate, endDate, status, maxPlayers, scoringMethod, numPromoted, numRelegated, tiebreaker, isPublic, joinType, description } = await req.json();

  if (!name || !startDate || !endDate) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  const playerCount = Number(maxPlayers);
  if (playerCount < 2 || playerCount > 12 || !Number.isInteger(playerCount)) {
    return NextResponse.json({ error: 'Max players must be between 2 and 12' }, { status: 400 });
  }

  const validScoringMethods = ['1_set_tiebreak', '1_set_no_tiebreak', 'best_of_3_tiebreak', 'best_of_3_no_tiebreak', 'best_of_5_tiebreak', 'best_of_5_no_tiebreak'];
  if (!validScoringMethods.includes(scoringMethod)) {
    return NextResponse.json({ error: 'Invalid scoring method' }, { status: 400 });
  }

  const validTiebreakers = ['head_to_head', 'most_sets_won', 'set_difference'];
  const resolvedTiebreaker = validTiebreakers.includes(tiebreaker) ? tiebreaker : 'set_difference';

  const promoted = Number(numPromoted ?? 2);
  const relegated = Number(numRelegated ?? 2);

  const resolvedJoinType = joinType === 'open_invite' ? 'open_invite' : 'invite_only';

  await sql`
    INSERT INTO leagues (name, season_start, season_end, status, max_players, scoring_method, num_promoted, num_relegated, tiebreaker, created_by, is_public, join_type, description)
    VALUES (${name}, ${startDate}, ${endDate}, ${status ?? 'upcoming'}, ${playerCount}, ${scoringMethod}, ${promoted}, ${relegated}, ${resolvedTiebreaker}, ${session.user.id}, ${isPublic !== false}, ${resolvedJoinType}, ${description ?? null})
  `;

  return NextResponse.json({ success: true }, { status: 201 });
}
