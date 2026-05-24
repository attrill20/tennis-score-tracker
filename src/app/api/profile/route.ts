import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { firstName, lastName, email, phone, gender, newPassword, isInjured } = await req.json();

  // Injury-only update from InjuryToggle
  if (isInjured !== undefined && !firstName && !lastName && !email) {
    await sql`UPDATE profiles SET is_injured = ${isInjured} WHERE id = ${session.user.id}`;
    return NextResponse.json({ success: true });
  }

  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: 'First name, last name and email are required' }, { status: 400 });
  }

  const existing = await sql`
    SELECT id FROM profiles WHERE email = ${email} AND id != ${session.user.id}
  `;
  if (existing.length > 0) {
    return NextResponse.json({ error: 'That email is already in use' }, { status: 409 });
  }

  const fullName = [firstName, lastName].join(' ');

  if (newPassword) {
    const newHash = await bcrypt.hash(newPassword, 12);
    await sql`
      UPDATE profiles
      SET first_name = ${firstName}, last_name = ${lastName}, full_name = ${fullName},
          email = ${email}, phone = ${phone || null}, gender = ${gender || null}, password_hash = ${newHash}
      WHERE id = ${session.user.id}
    `;
  } else {
    await sql`
      UPDATE profiles
      SET first_name = ${firstName}, last_name = ${lastName}, full_name = ${fullName},
          email = ${email}, phone = ${phone || null}, gender = ${gender || null}
      WHERE id = ${session.user.id}
    `;
  }

  return NextResponse.json({ success: true });
}
