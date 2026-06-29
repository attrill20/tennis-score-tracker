import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { generateNextRound } from '@/lib/tournament';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [completed, activated, archived] = await Promise.all([
    sql`
      UPDATE leagues
      SET status = 'completed'
      WHERE status = 'active'
        AND season_end < CURRENT_DATE
      RETURNING id, name
    `,
    sql`
      UPDATE leagues
      SET status = 'active'
      WHERE status = 'upcoming'
        AND season_start <= CURRENT_DATE
      RETURNING id, name
    `,
    sql`
      UPDATE leagues
      SET status = 'archived'
      WHERE status = 'completed'
        AND season_end < CURRENT_DATE - INTERVAL '1 month'
      RETURNING id, name
    `,
  ]);

  // Activate a multi-league tournament once its first round date arrives.
  await sql`
    UPDATE tournaments
    SET status = 'active'
    WHERE format = 'multi' AND status = 'upcoming' AND round_dates[1] <= CURRENT_DATE
  `;
  // Keep current-round divisions active while their tournament is active.
  await sql`
    UPDATE leagues l
    SET status = 'active'
    FROM tournaments t
    WHERE l.tournament_id = t.id
      AND t.status = 'active'
      AND l.status = 'upcoming'
      AND l.round_number = (SELECT MAX(round_number) FROM leagues WHERE tournament_id = t.id)
  `;

  // ── Multi-league tournaments: generate the next round once its start date arrives ──
  // Postgres arrays are 1-indexed: the next round after `cr` is round cr+1, dated round_dates[cr+1].
  // Doing the date comparison in SQL avoids JS Date timezone shifts.
  const due = await sql`
    SELECT t.id, lr.cr AS current_round
    FROM tournaments t
    CROSS JOIN LATERAL (
      SELECT COALESCE(MAX(round_number), 1) AS cr FROM leagues WHERE tournament_id = t.id
    ) lr
    WHERE t.format = 'multi'
      AND t.status IN ('upcoming', 'active')
      AND lr.cr < t.num_rounds
      AND t.round_dates[lr.cr + 1] <= CURRENT_DATE
  `;

  const roundsGenerated: { tournamentId: string; round: number; divisions: number }[] = [];
  for (const row of due) {
    const currentRound = Number(row.current_round);
    const ids = await generateNextRound(row.id as string, currentRound);
    if (ids.length > 0) {
      roundsGenerated.push({ tournamentId: row.id as string, round: currentRound + 1, divisions: ids.length });
    }
  }

  // Mark multi tournaments completed once their final date has passed.
  const tournamentsCompleted = await sql`
    UPDATE tournaments
    SET status = 'completed'
    WHERE format = 'multi' AND status <> 'archived' AND final_end < CURRENT_DATE
    RETURNING id, name
  `;

  return NextResponse.json({
    completed: completed.map((r) => ({ id: r.id, name: r.name })),
    activated: activated.map((r) => ({ id: r.id, name: r.name })),
    archived: archived.map((r) => ({ id: r.id, name: r.name })),
    roundsGenerated,
    tournamentsCompleted: tournamentsCompleted.map((r) => ({ id: r.id, name: r.name })),
  });
}
