import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { mergePlaceholderIntoAccount, MergeConflictError } from '@/lib/placeholders';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { realAccountId } = await req.json();
  if (!realAccountId) {
    return NextResponse.json({ error: 'A target account is required' }, { status: 400 });
  }

  try {
    await mergePlaceholderIntoAccount(id, realAccountId);
  } catch (e) {
    if (e instanceof MergeConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to merge' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
