import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

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

  return NextResponse.json({
    completed: completed.map((r) => ({ id: r.id, name: r.name })),
    activated: activated.map((r) => ({ id: r.id, name: r.name })),
    archived: archived.map((r) => ({ id: r.id, name: r.name })),
  });
}
