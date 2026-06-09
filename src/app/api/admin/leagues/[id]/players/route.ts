import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: leagueId } = await params;

  const leagues = await sql`SELECT league_type FROM leagues WHERE id = ${leagueId}`;
  const leagueType = (leagues[0]?.league_type as string) ?? 'singles';

  if (leagueType === 'doubles') {
    const rows = await sql`
      SELECT player_id, partner_id FROM league_players
      WHERE league_id = ${leagueId} AND partner_id IS NOT NULL
    `;
    // Deduplicate: each pair appears twice (A→B and B→A), keep one
    const seen = new Set<string>();
    const pairs: { p1Id: string; p2Id: string }[] = [];
    for (const row of rows) {
      const key = [row.player_id as string, row.partner_id as string].sort().join(':');
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ p1Id: row.player_id as string, p2Id: row.partner_id as string });
      }
    }
    return NextResponse.json({ leagueType: 'doubles', pairs });
  }

  const rows = await sql`SELECT player_id FROM league_players WHERE league_id = ${leagueId}`;
  return NextResponse.json(rows.map((r) => r.player_id));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: leagueId } = await params;
  const body = await req.json();

  // Doubles: body is { pairs: [{p1Id, p2Id}] }
  if (body.pairs) {
    const pairs = body.pairs as { p1Id: string; p2Id: string }[];
    if (!pairs.length) return NextResponse.json({ error: 'No pairs provided' }, { status: 400 });

    for (const { p1Id, p2Id } of pairs) {
      await sql`
        INSERT INTO league_players (league_id, player_id, partner_id)
        VALUES (${leagueId}, ${p1Id}, ${p2Id})
        ON CONFLICT (league_id, player_id) DO UPDATE SET partner_id = ${p2Id}
      `;
      await sql`
        INSERT INTO league_players (league_id, player_id, partner_id)
        VALUES (${leagueId}, ${p2Id}, ${p1Id})
        ON CONFLICT (league_id, player_id) DO UPDATE SET partner_id = ${p1Id}
      `;
    }
    return NextResponse.json({ success: true }, { status: 201 });
  }

  // Singles: body is { playerIds: [...] }
  const { playerIds } = body;
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return NextResponse.json({ error: 'No players provided' }, { status: 400 });
  }

  for (const playerId of playerIds) {
    await sql`
      INSERT INTO league_players (league_id, player_id)
      VALUES (${leagueId}, ${playerId})
      ON CONFLICT (league_id, player_id) DO NOTHING
    `;
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: leagueId } = await params;
  const body = await req.json();

  // Doubles: remove both players in the pair
  if (body.pairIds) {
    const [p1Id, p2Id] = body.pairIds as [string, string];
    await sql`DELETE FROM league_players WHERE league_id = ${leagueId} AND player_id IN (${p1Id}, ${p2Id})`;
    return NextResponse.json({ success: true });
  }

  // Singles: remove a single player
  const { playerId } = body;
  await sql`DELETE FROM league_players WHERE league_id = ${leagueId} AND player_id = ${playerId}`;
  return NextResponse.json({ success: true });
}
