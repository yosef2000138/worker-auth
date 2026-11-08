import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { env, parseEnvironment } from '../../config/env';
import { registerSchema } from './auth.schema';
import {
  consumeOneTimeToken,
  createSession,
  isSessionActive,
  revokeSession,
  rotateRefreshToken,
  storeOneTimeToken,
} from '../../config/redis';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../utils/jwt';

test('environment parses the string false as false', () => {
  const parsed = parseEnvironment({
    ...process.env,
    SUBSCRIPTIONS_ENABLED: 'false',
  });
  assert.equal(parsed.SUBSCRIPTIONS_ENABLED, false);
});

test('production environment rejects wildcard CORS origins', () => {
  assert.throws(() => parseEnvironment({
    ...process.env,
    NODE_ENV: 'production',
    CLIENT_URL: '*',
  }), /Wildcard CORS origins/);
});

test('webhook credentials reject weak secrets and allow an unset blank value', () => {
  assert.throws(() => parseEnvironment({
    ...process.env,
    REVENUECAT_WEBHOOK_AUTH_TOKEN: 'weak',
  }));

  const parsed = parseEnvironment({
    ...process.env,
    REVENUECAT_WEBHOOK_AUTH_TOKEN: '',
    REVENUECAT_WEBHOOK_SIGNING_SECRET: '',
  });
  assert.equal(parsed.REVENUECAT_WEBHOOK_AUTH_TOKEN, undefined);
  assert.equal(parsed.REVENUECAT_WEBHOOK_SIGNING_SECRET, undefined);
});

test('registration rejects a whitespace-only normalized name', () => {
  assert.equal(registerSchema.safeParse({
    body: {
      fullName: '   ',
      email: 'worker@example.com',
      password: 'Password1',
      role: 'WORKER',
    },
  }).success, false);
});

test('access token validation requires the server session claim', () => {
  const valid = signAccessToken({
    sub: 'security-user',
    sid: 'security-session',
    role: 'CUSTOMER',
    email: 'security@example.com',
  });
  assert.equal(verifyAccessToken(valid).sid, 'security-session');

  const missingSession = jwt.sign(
    { sub: 'security-user', role: 'CUSTOMER', email: 'security@example.com' },
    env.JWT_ACCESS_SECRET,
    {
      algorithm: 'HS256',
      issuer: 'worker-api',
      audience: 'worker-mobile',
      expiresIn: '1m',
    },
  );
  assert.throws(() => verifyAccessToken(missingSession), /Invalid sid claim/);
});

test('every refresh token has a unique token identifier', () => {
  const first = signRefreshToken({ sub: 'security-user', sid: 'security-session' });
  const second = signRefreshToken({ sub: 'security-user', sid: 'security-session' });

  assert.notEqual(first, second);
  assert.notEqual(verifyRefreshToken(first).jti, verifyRefreshToken(second).jti);
});

test('refresh rotation accepts a token once and revocation disables access', async () => {
  const userId = `security-user-${Date.now()}`;
  const sessionId = 'session-a';
  await createSession(userId, sessionId, 'refresh-a', 60);
  assert.equal(await isSessionActive(userId, sessionId), true);

  assert.equal(
    await rotateRefreshToken(userId, sessionId, 'refresh-a', 'refresh-b', 60),
    true,
  );
  assert.equal(
    await rotateRefreshToken(userId, sessionId, 'refresh-a', 'refresh-c', 60),
    false,
  );

  await revokeSession(userId);
  assert.equal(await isSessionActive(userId, sessionId), false);
});

test('password reset tokens are single-use and keyed by a digest', async () => {
  const token = 'a'.repeat(64);
  const userId = `reset-user-${Date.now()}`;
  await storeOneTimeToken('password-reset', token, userId, 60);

  assert.equal(await consumeOneTimeToken('password-reset', token), userId);
  assert.equal(await consumeOneTimeToken('password-reset', token), null);
});

test('issuing a new one-time token invalidates the previous token for that user', async () => {
  const firstToken = 'b'.repeat(64);
  const secondToken = 'c'.repeat(64);
  const userId = `latest-reset-user-${Date.now()}`;

  await storeOneTimeToken('password-reset', firstToken, userId, 60);
  await storeOneTimeToken('password-reset', secondToken, userId, 60);

  assert.equal(await consumeOneTimeToken('password-reset', firstToken), null);
  assert.equal(await consumeOneTimeToken('password-reset', secondToken), userId);
});
