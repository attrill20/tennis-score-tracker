import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const leagues = await sql`SELECT league_type FROM leagues WHERE id = ${id}`;
  const leagueType = (leagues[0]?.league_type as string) ?? 'singles';

  let players;

  if (leagueType === 'doubles') {
    // Look up the submitter's fixed partner for this league
    const partnerRows = await sql`
      SELECT lp.partner_id,
        CASE WHEN pp.is_placeholder AND pp.placeholder_anonymized THEN pp.placeholder_alias ELSE (pp.first_name || ' ' || pp.last_name) END AS partner_full_name
      FROM league_players lp
      LEFT JOIN profiles pp ON pp.id = lp.partner_id
      WHERE lp.league_id = ${id} AND lp.player_id = ${session.user.id}
    `;
    const myPartnerId = (partnerRows[0]?.partner_id as string) ?? null;
    const myPartnerName = (partnerRows[0]?.partner_full_name as string) ?? null;

    // Return opponent pairs not yet played — every registered pair except the submitter's own pair
    const pairRows = await sql`
      SELECT
        p.id AS p1_id,
        CASE WHEN p.is_placeholder AND p.placeholder_anonymized THEN p.placeholder_alias ELSE p.first_name END AS p1_first,
        CASE WHEN p.is_placeholder AND p.placeholder_anonymized THEN p.placeholder_alias ELSE (p.first_name || ' ' || p.last_name) END AS p1_full,
        pp.id AS p2_id,
        CASE WHEN pp.is_placeholder AND pp.placeholder_anonymized THEN pp.placeholder_alias ELSE pp.first_name END AS p2_first,
        CASE WHEN pp.is_placeholder AND pp.placeholder_anonymized THEN pp.placeholder_alias ELSE (pp.first_name || ' ' || pp.last_name) END AS p2_full
      FROM league_players lp
      JOIN profiles p ON p.id = lp.player_id
      LEFT JOIN profiles pp ON pp.id = lp.partner_id
      WHERE lp.league_id = ${id}
        AND lp.player_id != ${session.user.id}
        AND lp.player_id != ${myPartnerId}
        AND p.deleted_at IS NULL
        AND lp.partner_id IS NOT NULL
        AND lp.partner_id > lp.player_id
        AND NOT EXISTS (
          SELECT 1 FROM matches m
          WHERE m.league_id = ${id}
          AND m.status != 'disputed'
          AND (
            m.player1_id = lp.player_id OR m.player2_id = lp.player_id
            OR m.player3_id = lp.player_id OR m.player4_id = lp.player_id
          )
          AND (
            m.player1_id = ${session.user.id} OR m.player2_id = ${session.user.id}
            OR m.player3_id = ${session.user.id} OR m.player4_id = ${session.user.id}
          )
        )
      ORDER BY p.last_name, p.first_name
    `;

    const opponentPairs = pairRows.map((r) => ({
      p1Id: r.p1_id as string,
      p2Id: r.p2_id as string,
      label: `${r.p1_first as string} / ${r.p2_first as string}`,
      fullLabel: `${r.p1_full as string} + ${r.p2_full as string}`,
    }));

    return NextResponse.json({ leagueType, myPartnerId, myPartnerName, opponentPairs });
  } else {
    // For singles, return league players the requesting user hasn't played yet
    players = await sql`
      SELECT p.id, CASE WHEN p.is_placeholder AND p.placeholder_anonymized THEN p.placeholder_alias ELSE (p.first_name || ' ' || p.last_name) END AS full_name
      FROM profiles p
      JOIN league_players lp ON lp.player_id = p.id
      WHERE lp.league_id = ${id}
      AND p.id != ${session.user.id}
      AND p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM matches m
        WHERE m.league_id = ${id}
        AND m.status != 'disputed'
        AND (
          (m.player1_id = ${session.user.id} AND m.player2_id = p.id)
          OR
          (m.player2_id = ${session.user.id} AND m.player1_id = p.id)
        )
      )
      ORDER BY p.last_name, p.first_name
    `;
  }

  return NextResponse.json({ players, leagueType });
}
