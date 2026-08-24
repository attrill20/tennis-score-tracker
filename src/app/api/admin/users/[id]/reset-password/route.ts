import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: targetId } = await params;
  const { password } = await req.json();

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const target = await sql`SELECT role FROM profiles WHERE id = ${targetId}`;
  if (!target[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target[0].role === 'super_admin') {
    return NextResponse.json({ error: 'Cannot modify a super admin' }, { status: 403 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await sql`
    UPDATE profiles
    SET password_hash = ${passwordHash},
        reset_token = NULL,
        reset_token_expires = NULL,
        email_verified = true,
        role = CASE WHEN role = 'unverified' THEN 'member' ELSE role END
    WHERE id = ${targetId}
  `;

  return NextResponse.json({ success: true });
}
