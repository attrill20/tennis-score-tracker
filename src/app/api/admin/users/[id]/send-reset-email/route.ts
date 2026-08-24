import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/mailer';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: targetId } = await params;

  const target = await sql`SELECT email, role FROM profiles WHERE id = ${targetId}`;
  if (!target[0]) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target[0].role === 'super_admin') {
    return NextResponse.json({ error: 'Cannot modify a super admin' }, { status: 403 });
  }

  const email = target[0].email as string | null;
  if (!email) {
    return NextResponse.json({ error: 'This user has no email address on file' }, { status: 400 });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await sql`
    UPDATE profiles
    SET reset_token = ${resetToken},
        reset_token_expires = ${resetTokenExpires.toISOString()}
    WHERE id = ${targetId}
  `;

  try {
    await sendPasswordResetEmail(email, resetToken);
  } catch (err) {
    console.error('Failed to send admin-triggered password reset email:', err);
    return NextResponse.json({ error: 'The reset link was created but the email failed to send' }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
