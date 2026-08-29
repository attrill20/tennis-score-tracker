import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { updatePlaceholder, retirePlaceholder } from '@/lib/placeholders';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { fullName, alias, anonymized } = await req.json();
  if (!fullName?.trim()) {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
  }
  if (anonymized && !alias?.trim()) {
    return NextResponse.json({ error: 'An alias is required when anonymizing this placeholder' }, { status: 400 });
  }

  await updatePlaceholder(id, {
    fullName: fullName.trim(),
    alias: alias?.trim() || null,
    anonymized: !!anonymized,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await retirePlaceholder(id);

  return NextResponse.json({ success: true });
}
