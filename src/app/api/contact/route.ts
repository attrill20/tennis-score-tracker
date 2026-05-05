import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { subject, message } = await req.json();

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.CONTACT_EMAIL,
      pass: process.env.CONTACT_EMAIL_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"QPTC Score Tracker" <${process.env.CONTACT_EMAIL}>`,
    to: process.env.CONTACT_EMAIL,
    replyTo: session.user.email,
    subject: `[QPTC] ${subject}`,
    html: `
      <p><strong>From:</strong> ${session.user.name} (${session.user.email})</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <hr />
      <p>${message.replace(/\n/g, '<br />')}</p>
    `,
  });

  return NextResponse.json({ success: true });
}
