import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${env.CLIENT_URL}/verify-email?token=${token}`;
  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: email,
    subject: 'Verify your Worker account',
    html: `
      <h2>Welcome to Worker!</h2>
      <p>Click the link below to verify your email address:</p>
      <a href="${url}" style="background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">
        Verify Email
      </a>
      <p>This link expires in 24 hours.</p>
      <p>If you didn't create an account, ignore this email.</p>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${env.CLIENT_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: email,
    subject: 'Reset your Worker password',
    html: `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${url}" style="background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">
        Reset Password
      </a>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, ignore this email.</p>
    `,
  });
}
