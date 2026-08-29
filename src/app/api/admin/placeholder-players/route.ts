import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { createPlaceholder } from '@/lib/placeholders';

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await sql`
    SELECT id, full_name, placeholder_alias, placeholder_anonymized, deleted_at
    FROM profiles
    WHERE is_placeholder = true
    ORDER BY deleted_at IS NOT NULL, full_name
  `;

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { fullName, alias, anonymized } = await req.json();
  if (!fullName?.trim()) {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
  }
  if (anonymized && !alias?.trim()) {
    return NextResponse.json({ error: 'An alias is required when anonymizing this placeholder' }, { status: 400 });
  }

  const id = await createPlaceholder({
    fullName: fullName.trim(),
    alias: alias?.trim() || null,
    anonymized: !!anonymized,
  });

  return NextResponse.json({ id }, { status: 201 });
}
