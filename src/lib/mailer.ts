import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.CONTACT_EMAIL,
    pass: process.env.CONTACT_EMAIL_PASSWORD,
  },
});

const APP_URL = process.env.AUTH_URL ||
  process.env.NEXTAUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${APP_URL}/api/verify-email?token=${token}`;
  await transporter.sendMail({
    from: `"QPTC Score Tracker" <${process.env.CONTACT_EMAIL}>`,
    to,
    subject: 'Verify your email - QPTC Score Tracker',
    html: `
      <p>Welcome to QPTC Score Tracker!</p>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${link}">Verify email</a></p>
      <p>This link expires in 24 hours.</p>
      <p>If you did not create an account, you can ignore this email.</p>
    `,
  });
}

export async function sendVerificationReminderEmail(to: string, token: string) {
  const link = `${APP_URL}/api/verify-email?token=${token}`;
  await transporter.sendMail({
    from: `"QPTC Score Tracker" <${process.env.CONTACT_EMAIL}>`,
    to,
    subject: 'Reminder: please verify your email - QPTC Score Tracker',
    html: `
      <p>This is a reminder that your QPTC Score Tracker account has not yet been verified.</p>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${link}">Verify email</a></p>
      <p>This link expires in 24 hours.</p>
      <p>If you did not create an account, you can ignore this email.</p>
    `,
  });
}

export async function sendVerificationFinalWarningEmail(to: string, token: string) {
  const link = `${APP_URL}/api/verify-email?token=${token}`;
  await transporter.sendMail({
    from: `"QPTC Score Tracker" <${process.env.CONTACT_EMAIL}>`,
    to,
    subject: 'Final reminder: verify your email or your account will be deleted - QPTC Score Tracker',
    html: `
      <p>Your QPTC Score Tracker account has still not been verified.</p>
      <p>If you do not verify your email within the next 2 days, your account will be deleted.</p>
      <p><a href="${link}">Verify email</a></p>
      <p>This link expires in 24 hours.</p>
      <p>If you did not create an account, you can ignore this email.</p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: `"QPTC Score Tracker" <${process.env.CONTACT_EMAIL}>`,
    to,
    subject: 'Reset your password - QPTC Score Tracker',
    html: `
      <p>You requested a password reset for your QPTC Score Tracker account.</p>
      <p>Click the link below to set a new password:</p>
      <p><a href="${link}">Reset password</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
}
