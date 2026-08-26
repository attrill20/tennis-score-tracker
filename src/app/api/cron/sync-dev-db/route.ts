import { NextRequest, NextResponse } from 'next/server';
import { resetDevBranchFromProd } from '@/lib/neonApi';
import { anonymizeDevDatabase } from '@/lib/anonymizeDevDb';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await resetDevBranchFromProd();
  const result = await anonymizeDevDatabase();

  return NextResponse.json({ synced: true, ...result });
}
