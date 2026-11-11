import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { db } from '../../config/database';
import {
  consumeOneTimeToken,
  createSession,
  revokeSession,
  rotateRefreshToken,
  storeOneTimeToken,
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
import { disconnectUserSockets } from '../../sockets';
import { LoginInput, RegisterInput } from './auth.schema';
import { logger } from '../../utils/logger';

type SessionIdentity = Pick<JwtPayload, 'sub' | 'role' | 'email'>;
const DUMMY_PASSWORD_HASH = '$2a$12$v6Usfi3rLTq19G1XktNNEe0BDTpWOMIN96AYqe1CawegpCQ3SOjgi';

function buildTokens(identity: SessionIdentity, sessionId = crypto.randomUUID()) {
  const accessToken = signAccessToken({ ...identity, sid: sessionId });
  const refreshToken = signRefreshToken({ sub: identity.sub, sid: sessionId });
  return { accessToken, refreshToken, sessionId };
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
  sendVerificationEmail(email, token).catch(() => {
    logger.warn('email.verification_delivery_failed');
  });
}

function sendPasswordResetEmailInBackground(email: string, token: string) {
  sendPasswordResetEmail(email, token).catch(() => {
    logger.warn('email.password_reset_delivery_failed');
  });
}

function identityFor(user: { id: string; role: JwtPayload['role']; email: string }): SessionIdentity {
  return { sub: user.id, role: user.role, email: user.email };
}

async function establishSession(identity: SessionIdentity) {
  const tokens = buildTokens(identity);
  await revokeSession(identity.sub);
  disconnectUserSockets(identity.sub);
  await createSession(
    identity.sub,
    tokens.sessionId,
    tokens.refreshToken,
    parseTTLSeconds(env.JWT_REFRESH_EXPIRES_IN),
  );
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
}

export async function register(input: RegisterInput) {
  const passwordHash = await hashPassword(input.password);
  const verifyToken = crypto.randomBytes(32).toString('hex');

  let user;
  try {
    user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          passwordHash,
          role: input.role,
        },
      });

      if (input.role === 'WORKER') {
        await tx.worker.create({ data: { userId: created.id } });
      }

      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw { status: 409, code: 'EMAIL_ALREADY_IN_USE', message: 'Email already in use' };
    }
    throw error;
  }

  await storeOneTimeToken('email-verification', verifyToken, user.id, 86400);
  const tokens = await establishSession(identityFor(user));
  sendVerificationEmailInBackground(input.email, verifyToken);

  return { user: safeUser(user), ...tokens };
}

export async function login(input: LoginInput) {
  const user = await db.user.findUnique({ where: { email: input.email } });
  const valid = await comparePassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid) throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' };
  if (!user.isActive) throw { status: 403, code: 'ACCOUNT_SUSPENDED', message: 'Account suspended' };

  const tokens = await establishSession(identityFor(user));
  return { user: safeUser(user), ...tokens };
}

export async function logout(userId: string) {
  await revokeSession(userId);
  disconnectUserSockets(userId);
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw { status: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' };
  }

  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    await revokeSession(payload.sub);
    disconnectUserSockets(payload.sub);
    throw { status: 401, code: 'SESSION_REVOKED', message: 'Session is no longer active' };
  }

  const nextTokens = buildTokens(identityFor(user), payload.sid);
  const rotated = await rotateRefreshToken(
    user.id,
    payload.sid,
    refreshToken,
    nextTokens.refreshToken,
    parseTTLSeconds(env.JWT_REFRESH_EXPIRES_IN),
  );

  if (!rotated) {
    await revokeSession(user.id);
    disconnectUserSockets(user.id);
    throw { status: 401, code: 'REFRESH_TOKEN_REUSED', message: 'Refresh token expired or reused' };
  }

  return {
    user: safeUser(user),
    accessToken: nextTokens.accessToken,
    refreshToken: nextTokens.refreshToken,
  };
}

export async function verifyEmail(token: string) {
  const userId = await consumeOneTimeToken('email-verification', token);
  if (!userId) {
    throw { status: 400, code: 'INVALID_VERIFICATION_TOKEN', message: 'Invalid or expired verification token' };
  }

  await db.user.update({ where: { id: userId }, data: { isVerified: true } });
  return { message: 'Email verified successfully' };
}

export async function forgotPassword(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  const response = { message: 'If that email exists, a reset link has been sent' };
  if (!user || !user.isActive) return response;

  const resetToken = crypto.randomBytes(32).toString('hex');
  await storeOneTimeToken('password-reset', resetToken, user.id, 3600);
  sendPasswordResetEmailInBackground(email, resetToken);
  return response;
}

export async function resetPassword(token: string, newPassword: string) {
  const userId = await consumeOneTimeToken('password-reset', token);
  if (!userId) {
    throw { status: 400, code: 'INVALID_RESET_TOKEN', message: 'Invalid or expired reset token' };
  }

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({ where: { id: userId }, data: { passwordHash } });
  await revokeSession(userId);
  disconnectUserSockets(userId);
  return { message: 'Password reset successfully. Please log in.' };
}
