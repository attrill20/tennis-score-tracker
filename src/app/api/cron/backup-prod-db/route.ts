import { NextRequest, NextResponse } from 'next/server';
import { backupProdDatabase } from '@/lib/backupProdDb';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await backupProdDatabase();

  return NextResponse.json({ backedUp: true, ...result });
}
