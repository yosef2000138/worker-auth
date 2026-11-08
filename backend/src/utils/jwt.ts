import crypto from 'crypto';
import jwt, { JwtPayload as LibraryJwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export type UserRole = 'CUSTOMER' | 'WORKER' | 'ADMIN';

export interface JwtPayload {
  sub: string;
  sid: string;
  role: UserRole;
  email: string;
  iat?: number;
  exp?: number;
}

export interface RefreshJwtPayload {
  sub: string;
  sid: string;
  jti: string;
  iat?: number;
  exp?: number;
}

const JWT_ISSUER = 'worker-api';
const JWT_AUDIENCE = 'worker-mobile';
const JWT_ALGORITHM = 'HS256' as const;

const verifyOptions: VerifyOptions = {
  algorithms: [JWT_ALGORITHM],
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
};

function signOptions(expiresIn: string): SignOptions {
  return {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn,
  } as SignOptions;
}

function isJwtObject(payload: string | LibraryJwtPayload): payload is LibraryJwtPayload {
  return typeof payload === 'object' && payload !== null;
}

function requireStringClaim(payload: LibraryJwtPayload, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid ${key} claim`);
  }
  return value;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, signOptions(env.JWT_ACCESS_EXPIRES_IN));
}

export function signRefreshToken(payload: Pick<RefreshJwtPayload, 'sub' | 'sid'>): string {
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    signOptions(env.JWT_REFRESH_EXPIRES_IN),
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, verifyOptions);
  if (!isJwtObject(decoded)) throw new Error('Invalid access token payload');

  const role = requireStringClaim(decoded, 'role');
  if (role !== 'CUSTOMER' && role !== 'WORKER' && role !== 'ADMIN') {
    throw new Error('Invalid role claim');
  }

  return {
    sub: requireStringClaim(decoded, 'sub'),
    sid: requireStringClaim(decoded, 'sid'),
    role,
    email: requireStringClaim(decoded, 'email'),
    iat: decoded.iat,
    exp: decoded.exp,
  };
}

export function verifyRefreshToken(token: string): RefreshJwtPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, verifyOptions);
  if (!isJwtObject(decoded)) throw new Error('Invalid refresh token payload');

  return {
    sub: requireStringClaim(decoded, 'sub'),
    sid: requireStringClaim(decoded, 'sid'),
    jti: requireStringClaim(decoded, 'jti'),
    iat: decoded.iat,
    exp: decoded.exp,
  };
}

export function parseTTLSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) throw new Error(`Invalid token TTL: ${duration}`);

  const value = Number(match[1]);
  const multiplier: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multiplier[match[2]];
}
