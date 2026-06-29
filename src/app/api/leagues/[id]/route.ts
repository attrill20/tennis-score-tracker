import { auth } from '@/auth';
import sql from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { name, seasonStart, seasonEnd, isPublic, description, status, tiebreaker, color, scoringMethod, maxPlayers, numPromoted, numRelegated, joinType } = await req.json();

  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    await sql`UPDATE leagues SET name = ${name.trim()} WHERE id = ${id}`;
  }

  if (seasonStart !== undefined || seasonEnd !== undefined) {
    if (!seasonStart || !seasonEnd) {
      return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 });
    }
    if (seasonEnd <= seasonStart) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }
    await sql`UPDATE leagues SET season_start = ${seasonStart}, season_end = ${seasonEnd} WHERE id = ${id}`;
  }

  if (isPublic !== undefined) {
    await sql`UPDATE leagues SET is_public = ${isPublic} WHERE id = ${id}`;
  }

  if (status !== undefined) {
    const valid = ['upcoming', 'active', 'completed'];
    if (!valid.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    await sql`UPDATE leagues SET status = ${status} WHERE id = ${id}`;
  }

  if (description !== undefined) {
    await sql`UPDATE leagues SET description = ${description || null} WHERE id = ${id}`;
  }

  if (tiebreaker !== undefined) {
    const valid = ['head_to_head', 'most_sets_won', 'set_difference'];
    if (!valid.includes(tiebreaker)) return NextResponse.json({ error: 'Invalid tiebreaker' }, { status: 400 });
    await sql`UPDATE leagues SET tiebreaker = ${tiebreaker} WHERE id = ${id}`;
  }

  if (color !== undefined) {
    const valid = ['blue', 'purple', 'orange', 'pink', 'teal', 'indigo', 'cyan', 'rose', 'yellow', 'green', 'lime', 'violet', 'amber', 'sky'];
    if (!valid.includes(color)) return NextResponse.json({ error: 'Invalid color' }, { status: 400 });
    await sql`UPDATE leagues SET color = ${color} WHERE id = ${id}`;
  }

  if (scoringMethod !== undefined) {
    const valid = ['1_set_tiebreak', '1_set_no_tiebreak', 'best_of_3_tiebreak', 'best_of_3_no_tiebreak', 'best_of_5_tiebreak', 'best_of_5_no_tiebreak'];
    if (!valid.includes(scoringMethod)) return NextResponse.json({ error: 'Invalid scoring method' }, { status: 400 });
    await sql`UPDATE leagues SET scoring_method = ${scoringMethod} WHERE id = ${id}`;
  }

  if (maxPlayers !== undefined) {
    const n = Number(maxPlayers);
    if (!Number.isInteger(n) || n < 2 || n > 12) return NextResponse.json({ error: 'Max players must be between 2 and 12' }, { status: 400 });
    await sql`UPDATE leagues SET max_players = ${n} WHERE id = ${id}`;
  }

  if (numPromoted !== undefined) {
    await sql`UPDATE leagues SET num_promoted = ${Number(numPromoted)} WHERE id = ${id}`;
  }

  if (numRelegated !== undefined) {
    await sql`UPDATE leagues SET num_relegated = ${Number(numRelegated)} WHERE id = ${id}`;
  }

  if (joinType !== undefined) {
    const valid = ['invite_only', 'open_invite'];
    if (!valid.includes(joinType)) return NextResponse.json({ error: 'Invalid join type' }, { status: 400 });
    await sql`UPDATE leagues SET join_type = ${joinType} WHERE id = ${id}`;
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const [row] = await sql`SELECT tournament_id FROM leagues WHERE id = ${id}`;

  await sql`DELETE FROM disputes WHERE match_id IN (SELECT id FROM matches WHERE league_id = ${id})`;
  await sql`DELETE FROM matches WHERE league_id = ${id}`;
  await sql`DELETE FROM league_players WHERE league_id = ${id}`;
  await sql`DELETE FROM leagues WHERE id = ${id}`;

  // Remove the parent tournament once it has no divisions left, so it doesn't linger in the admin list.
  if (row?.tournament_id) {
    await sql`
      DELETE FROM tournaments t
      WHERE t.id = ${row.tournament_id}
        AND NOT EXISTS (SELECT 1 FROM leagues WHERE tournament_id = t.id)
    `;
  }

  return NextResponse.json({ ok: true });
}
