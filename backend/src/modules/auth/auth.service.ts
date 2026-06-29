import crypto from 'crypto';
import { db } from '../../config/database';
import {
  deleteRefreshToken,
  getRefreshToken,
  storeRefreshToken,
} from '../../config/redis';
import { comparePassword, hashPassword } from '../../utils/bcrypt';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../utils/email';
import {
  JwtPayload,
  parseTTLSeconds,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt';
import { env } from '../../config/env';
import { LoginInput, RegisterInput } from './auth.schema';

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildTokens(payload: JwtPayload) {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ sub: payload.sub });
  return { accessToken, refreshToken };
}

function safeUser(user: {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
  isVerified: boolean;
}) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
  };
}

function sendVerificationEmailInBackground(email: string, token: string) {
  sendVerificationEmail(email, token).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Verification email failed for ${email}: ${message}`);
  });
}

// ─── Register ────────────────────────────────────────────────────────────────

export async function register(input: RegisterInput) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw { status: 409, message: 'Email already in use' };

  const passwordHash = await hashPassword(input.password);
  const verifyToken = crypto.randomBytes(32).toString('hex');

  const user = await db.user.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: input.role,
      // Store token hash; we'll clear it after verification
      // In a real app use a separate VerificationToken table
    },
  });

  // Store email verification token in Redis (24h)
  await storeRefreshToken(`verify:${user.id}`, verifyToken, 86400);

  // If worker role, create worker profile scaffold
  if (input.role === 'WORKER') {
    await db.worker.create({ data: { userId: user.id } });
  }

  const payload: JwtPayload = { sub: user.id, role: user.role, email: user.email };
  const { accessToken, refreshToken } = buildTokens(payload);

  await storeRefreshToken(
    user.id,
    refreshToken,
    parseTTLSeconds(env.JWT_REFRESH_EXPIRES_IN),
  );

  sendVerificationEmailInBackground(input.email, verifyToken);

  return { user: safeUser(user), accessToken, refreshToken };
}

// ─── Login ───────────────────────────────────────────────────────────────────

export async function login(input: LoginInput) {
  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user) throw { status: 401, message: 'Invalid credentials' };
  if (!user.isActive) throw { status: 403, message: 'Account suspended' };

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) throw { status: 401, message: 'Invalid credentials' };

  const payload: JwtPayload = { sub: user.id, role: user.role, email: user.email };
  const { accessToken, refreshToken } = buildTokens(payload);

  await storeRefreshToken(
    user.id,
    refreshToken,
    parseTTLSeconds(env.JWT_REFRESH_EXPIRES_IN),
  );

  return { user: safeUser(user), accessToken, refreshToken };
}

// ─── Logout ──────────────────────────────────────────────────────────────────

export async function logout(userId: string) {
  await deleteRefreshToken(userId);
}

// ─── Refresh ─────────────────────────────────────────────────────────────────

export async function refresh(refreshToken: string) {
  let payload: Pick<JwtPayload, 'sub'>;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw { status: 401, message: 'Invalid refresh token' };
  }

  const stored = await getRefreshToken(payload.sub);
  if (!stored || stored !== refreshToken) {
    throw { status: 401, message: 'Refresh token expired or reused' };
  }

  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) throw { status: 401, message: 'User not found' };

  const newPayload: JwtPayload = { sub: user.id, role: user.role, email: user.email };
  const { accessToken, refreshToken: newRefresh } = buildTokens(newPayload);

  // Rotate refresh token
  await deleteRefreshToken(user.id);
  await storeRefreshToken(
    user.id,
    newRefresh,
    parseTTLSeconds(env.JWT_REFRESH_EXPIRES_IN),
  );

  return {
    user: safeUser(user),
    accessToken,
    refreshToken: newRefresh,
  };
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

export async function verifyEmail(token: string) {
  // Find user whose verification token matches
  // (Simplified: in production use a VerificationToken table)
  const users = await db.user.findMany({ where: { isVerified: false } });

  for (const user of users) {
    const stored = await getRefreshToken(`verify:${user.id}`);
    if (stored === token) {
      await db.user.update({ where: { id: user.id }, data: { isVerified: true } });
      await deleteRefreshToken(`verify:${user.id}`);
      return { message: 'Email verified successfully' };
    }
  }

  throw { status: 400, message: 'Invalid or expired verification token' };
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

export async function forgotPassword(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  // Always return success to avoid user enumeration
  if (!user) return { message: 'If that email exists, a reset link has been sent' };

  const resetToken = crypto.randomBytes(32).toString('hex');
  await storeRefreshToken(`reset:${user.id}`, resetToken, 3600); // 1 hour

  await sendPasswordResetEmail(email, resetToken);
  return { message: 'If that email exists, a reset link has been sent' };
}

// ─── Reset Password ───────────────────────────────────────────────────────────

export async function resetPassword(token: string, newPassword: string) {
  const users = await db.user.findMany();

  for (const user of users) {
    const stored = await getRefreshToken(`reset:${user.id}`);
    if (stored === token) {
      const passwordHash = await hashPassword(newPassword);
      await db.user.update({ where: { id: user.id }, data: { passwordHash } });
      await deleteRefreshToken(`reset:${user.id}`);
      // Invalidate all sessions
      await deleteRefreshToken(user.id);
      return { message: 'Password reset successfully. Please log in.' };
    }
  }

  throw { status: 400, message: 'Invalid or expired reset token' };
}
