import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: targetId } = await params;
  const { role } = await req.json();

  if (!['member', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Prevent demoting another super_admin
  const target = await sql`SELECT role FROM profiles WHERE id = ${targetId}`;
  if (target[0]?.role === 'super_admin') {
    return NextResponse.json({ error: 'Cannot change a super admin role' }, { status: 403 });
  }

  await sql`UPDATE profiles SET role = ${role} WHERE id = ${targetId}`;

  return NextResponse.json({ success: true });
}
