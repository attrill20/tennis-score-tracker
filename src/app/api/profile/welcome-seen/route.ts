import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function PATCH() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await sql`UPDATE profiles SET welcome_seen = true WHERE id = ${session.user.id}`;

  return NextResponse.json({ success: true });
}
