import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { individualEligible, pairEligible } from '@/lib/genderCategory';
import { findPlaceholderTournamentNameConflict } from '@/lib/placeholders';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: leagueId } = await params;

  const leagues = await sql`SELECT league_type, status FROM leagues WHERE id = ${leagueId}`;
  const leagueType = (leagues[0]?.league_type as string) ?? 'singles';
  const isDraft = leagues[0]?.status === 'upcoming';

  if (leagueType === 'doubles') {
    const rows = isDraft
      ? await sql`SELECT player_id, partner_id FROM league_player_drafts WHERE league_id = ${leagueId} AND partner_id IS NOT NULL`
      : await sql`SELECT player_id, partner_id FROM league_players WHERE league_id = ${leagueId} AND partner_id IS NOT NULL`;
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
    return NextResponse.json({ leagueType: 'doubles', pairs, isDraft });
  }

  const rows = isDraft
    ? await sql`SELECT player_id FROM league_player_drafts WHERE league_id = ${leagueId}`
    : await sql`SELECT player_id FROM league_players WHERE league_id = ${leagueId}`;
  return NextResponse.json({ playerIds: rows.map((r) => r.player_id), isDraft });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: leagueId } = await params;
  const body = await req.json();
  const force = body.force === true;

  const [league] = await sql`SELECT gender_category, status, tournament_id FROM leagues WHERE id = ${leagueId}`;
  const genderCategory = (league?.gender_category as string) ?? 'either';
  const tournamentId = (league?.tournament_id as string) ?? null;
  // While a division is upcoming, assignment is staged as a draft - it never touches
  // league_players or tournament_registrations.assigned_league_id until the division
  // actually goes active (see src/lib/divisionDrafts.ts), so nothing is visible early.
  const isDraft = league?.status === 'upcoming';

  // Doubles: body is { pairs: [{p1Id, p2Id}] }
  if (body.pairs) {
    const pairs = body.pairs as { p1Id: string; p2Id: string }[];
    if (!pairs.length) return NextResponse.json({ error: 'No pairs provided' }, { status: 400 });

    if (tournamentId) {
      for (const { p1Id, p2Id } of pairs) {
        for (const id of [p1Id, p2Id]) {
          const conflict = await findPlaceholderTournamentNameConflict(id, tournamentId);
          if (conflict) {
            return NextResponse.json({
              error: `${conflict.fullName} is already in this tournament with the same name - rename one of them to tell them apart before adding.`,
            }, { status: 400 });
          }
        }
      }
    }

    if (!force) {
      for (const { p1Id, p2Id } of pairs) {
        const genderRows = await sql`
          SELECT id, gender, (first_name || ' ' || last_name) AS full_name
          FROM profiles WHERE id IN (${p1Id}, ${p2Id})
        `;
        const g1 = genderRows.find((r) => r.id === p1Id);
        const g2 = genderRows.find((r) => r.id === p2Id);

        const check1 = individualEligible(genderCategory, (g1?.gender as string) ?? null, g1?.full_name as string);
        if (!check1.eligible) return NextResponse.json({ error: check1.reason, needsConfirmation: true }, { status: 409 });
        const check2 = individualEligible(genderCategory, (g2?.gender as string) ?? null, g2?.full_name as string);
        if (!check2.eligible) return NextResponse.json({ error: check2.reason, needsConfirmation: true }, { status: 409 });

        const pairCheck = pairEligible(genderCategory, (g1?.gender as string) ?? null, (g2?.gender as string) ?? null);
        if (!pairCheck.eligible) return NextResponse.json({ error: pairCheck.reason, needsConfirmation: true }, { status: 409 });
      }
    }

    for (const { p1Id, p2Id } of pairs) {
      if (isDraft) {
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
      } else {
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
        await sql`
          UPDATE tournament_registrations SET assigned_league_id = ${leagueId}, updated_at = now()
          WHERE player_id IN (${p1Id}, ${p2Id})
            AND tournament_id = (SELECT tournament_id FROM leagues WHERE id = ${leagueId})
        `;
      }
    }
    return NextResponse.json({ success: true }, { status: 201 });
  }

  // Singles: body is { playerIds: [...] }
  const { playerIds } = body;
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return NextResponse.json({ error: 'No players provided' }, { status: 400 });
  }

  if (tournamentId) {
    for (const playerId of playerIds) {
      const conflict = await findPlaceholderTournamentNameConflict(playerId, tournamentId);
      if (conflict) {
        return NextResponse.json({
          error: `${conflict.fullName} is already in this tournament with the same name - rename one of them to tell them apart before adding.`,
        }, { status: 400 });
      }
    }
  }

  if (!force) {
    const genderRows = await sql`
      SELECT id, gender, (first_name || ' ' || last_name) AS full_name
      FROM profiles WHERE id = ANY(${playerIds}::uuid[])
    `;
    for (const playerId of playerIds) {
      const row = genderRows.find((r) => r.id === playerId);
      const check = individualEligible(genderCategory, (row?.gender as string) ?? null, row?.full_name as string);
      if (!check.eligible) return NextResponse.json({ error: check.reason, needsConfirmation: true }, { status: 409 });
    }
  }

  for (const playerId of playerIds) {
    if (isDraft) {
      await sql`
        INSERT INTO league_player_drafts (league_id, player_id)
        VALUES (${leagueId}, ${playerId})
        ON CONFLICT (league_id, player_id) DO NOTHING
      `;
    } else {
      await sql`
        INSERT INTO league_players (league_id, player_id)
        VALUES (${leagueId}, ${playerId})
        ON CONFLICT (league_id, player_id) DO NOTHING
      `;
      await sql`
        UPDATE tournament_registrations SET assigned_league_id = ${leagueId}, updated_at = now()
        WHERE player_id = ${playerId}
          AND tournament_id = (SELECT tournament_id FROM leagues WHERE id = ${leagueId})
      `;
    }
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

  const [league] = await sql`SELECT status FROM leagues WHERE id = ${leagueId}`;
  const isDraft = league?.status === 'upcoming';

  // Doubles: remove both players in the pair
  if (body.pairIds) {
    const [p1Id, p2Id] = body.pairIds as [string, string];
    if (isDraft) {
      await sql`DELETE FROM league_player_drafts WHERE league_id = ${leagueId} AND player_id IN (${p1Id}, ${p2Id})`;
    } else {
      await sql`DELETE FROM league_players WHERE league_id = ${leagueId} AND player_id IN (${p1Id}, ${p2Id})`;
      await sql`
        UPDATE tournament_registrations SET assigned_league_id = NULL, updated_at = now()
        WHERE player_id IN (${p1Id}, ${p2Id}) AND assigned_league_id = ${leagueId}
      `;
    }
    return NextResponse.json({ success: true });
  }

  // Singles: remove a single player
  const { playerId } = body;
  if (isDraft) {
    await sql`DELETE FROM league_player_drafts WHERE league_id = ${leagueId} AND player_id = ${playerId}`;
  } else {
    await sql`DELETE FROM league_players WHERE league_id = ${leagueId} AND player_id = ${playerId}`;
    await sql`
      UPDATE tournament_registrations SET assigned_league_id = NULL, updated_at = now()
      WHERE player_id = ${playerId} AND assigned_league_id = ${leagueId}
    `;
  }
  return NextResponse.json({ success: true });
}
