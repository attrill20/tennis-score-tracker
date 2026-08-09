import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import bcrypt from 'bcryptjs';
import { softDeleteAccount } from '@/lib/accountDeletion';

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

  const nameClash = await sql`
    SELECT id FROM profiles
    WHERE LOWER(first_name) = LOWER(${firstName}) AND LOWER(last_name) = LOWER(${lastName})
    AND id != ${session.user.id}
  `;
  if (nameClash.length > 0) {
    return NextResponse.json({
      error: `A member called ${firstName} ${lastName} is already registered - please add a slightly different name to distinguish yourself from the other member, e.g. a middle name or initial, a nickname, or a shortened version (e.g. Dan instead of Daniel).`,
    }, { status: 409 });
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

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { password } = await req.json();
  if (!password) return NextResponse.json({ error: 'Password is required' }, { status: 400 });

  const rows = await sql`SELECT password_hash, role, deleted_at FROM profiles WHERE id = ${session.user.id}`;
  const profile = rows[0];
  if (!profile || profile.deleted_at) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const passwordMatch = await bcrypt.compare(password, profile.password_hash as string);
  if (!passwordMatch) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 400 });
  }

  if (profile.role === 'super_admin') {
    return NextResponse.json({ error: 'Super admin accounts cannot be self-deleted' }, { status: 403 });
  }

  await softDeleteAccount(session.user.id);

  return NextResponse.json({ success: true });
}
