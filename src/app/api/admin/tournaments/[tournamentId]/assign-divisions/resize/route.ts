import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resizeCurrentRoundDivisions } from '@/lib/divisionDrafts';

export async function POST(req: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { tournamentId } = await params;
  const { numDivisions, force } = await req.json();

  const n = Number(numDivisions);
  if (!Number.isInteger(n) || n < 2 || n > 10) {
    return NextResponse.json({ error: 'Number of divisions must be between 2 and 10' }, { status: 400 });
  }

  const result = await resizeCurrentRoundDivisions(tournamentId, n, force === true);

  if (result.status === 'error') {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }
  if (result.status === 'needs_confirmation') {
    return NextResponse.json({ error: result.message, needsConfirmation: true }, { status: 409 });
  }
  return NextResponse.json({ success: true, created: result.created, removed: result.removed });
}
