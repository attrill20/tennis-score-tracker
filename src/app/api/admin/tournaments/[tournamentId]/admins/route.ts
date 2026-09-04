import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tournamentId: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tournamentId } = await params;
  const rows = await sql`SELECT admin_id FROM tournament_admins WHERE tournament_id = ${tournamentId}`;
  return NextResponse.json({ adminIds: rows.map((r) => r.admin_id) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tournamentId: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tournamentId } = await params;
  const { adminId } = await req.json();
  if (!adminId) return NextResponse.json({ error: 'No admin provided' }, { status: 400 });

  const [tournament] = await sql`SELECT created_by FROM tournaments WHERE id = ${tournamentId}`;
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  if (tournament.created_by === adminId) {
    return NextResponse.json({ error: 'This member already manages the tournament as its creator' }, { status: 400 });
  }

  const [target] = await sql`SELECT role FROM profiles WHERE id = ${adminId} AND deleted_at IS NULL`;
  if (!target || (target.role !== 'admin' && target.role !== 'super_admin')) {
    return NextResponse.json({ error: 'That member is not an admin' }, { status: 400 });
  }

  await sql`
    INSERT INTO tournament_admins (tournament_id, admin_id)
    VALUES (${tournamentId}, ${adminId})
    ON CONFLICT (tournament_id, admin_id) DO NOTHING
  `;
  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tournamentId: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tournamentId } = await params;
  const { adminId } = await req.json();
  if (!adminId) return NextResponse.json({ error: 'No admin provided' }, { status: 400 });

  await sql`DELETE FROM tournament_admins WHERE tournament_id = ${tournamentId} AND admin_id = ${adminId}`;
  return NextResponse.json({ success: true });
}
