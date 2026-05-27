import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: targetId } = await params;
  const body = await req.json();

  // Prevent modifying another super_admin
  const target = await sql`SELECT role FROM profiles WHERE id = ${targetId}`;
  if (target[0]?.role === 'super_admin') {
    return NextResponse.json({ error: 'Cannot modify a super admin' }, { status: 403 });
  }

  if (body.role !== undefined) {
    if (!['member', 'admin'].includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    await sql`UPDATE profiles SET role = ${body.role} WHERE id = ${targetId}`;
  }

  if (body.firstName !== undefined || body.lastName !== undefined || body.email !== undefined || body.phone !== undefined || body.gender !== undefined) {
    const { firstName, lastName, email, phone, gender } = body;
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 });
    }
    await sql`
      UPDATE profiles
      SET first_name = ${firstName.trim()},
          last_name = ${lastName.trim()},
          email = ${email?.trim() || null},
          phone = ${phone?.trim() || null},
          gender = ${gender || null}
      WHERE id = ${targetId}
    `;
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: targetId } = await params;

  // Prevent deleting self or another super_admin
  if (targetId === session.user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }
  const target = await sql`SELECT role FROM profiles WHERE id = ${targetId}`;
  if (!target[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target[0].role === 'super_admin') {
    return NextResponse.json({ error: 'Cannot delete a super admin' }, { status: 403 });
  }

  await sql`DELETE FROM disputes WHERE raised_by = ${targetId} OR resolved_by = ${targetId}`;
  await sql`DELETE FROM league_players WHERE player_id = ${targetId}`;
  await sql`DELETE FROM profiles WHERE id = ${targetId}`;

  return NextResponse.json({ success: true });
}
