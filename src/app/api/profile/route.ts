import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, firstName, lastName, email, currentPassword, newPassword, isInjured } = await req.json();

  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: 'First name, last name and email are required' }, { status: 400 });
  }

  const existing = await sql`
    SELECT id FROM profiles WHERE email = ${email} AND id != ${session.user.id}
  `;
  if (existing.length > 0) {
    return NextResponse.json({ error: 'That email is already in use' }, { status: 409 });
  }

  const fullName = [title, firstName, lastName].filter(Boolean).join(' ');

  if (newPassword) {
    const rows = await sql`SELECT password_hash FROM profiles WHERE id = ${session.user.id}`;
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash as string);
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }
    const newHash = await bcrypt.hash(newPassword, 12);
    await sql`
      UPDATE profiles
      SET title = ${title || null}, first_name = ${firstName}, last_name = ${lastName},
          full_name = ${fullName}, email = ${email}, password_hash = ${newHash},
          is_injured = ${isInjured ?? false}
      WHERE id = ${session.user.id}
    `;
  } else {
    await sql`
      UPDATE profiles
      SET title = ${title || null}, first_name = ${firstName}, last_name = ${lastName},
          full_name = ${fullName}, email = ${email}, is_injured = ${isInjured ?? false}
      WHERE id = ${session.user.id}
    `;
  }

  return NextResponse.json({ success: true });
}
