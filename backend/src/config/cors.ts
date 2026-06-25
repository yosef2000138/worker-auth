import { env } from './env';

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '');

export const allowedOrigins = env.CLIENT_URL.split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

export function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes('*')) return true;
  return allowedOrigins.includes(normalizeOrigin(origin));
}

export function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) {
  if (isOriginAllowed(origin)) return callback(null, true);
  return callback(new Error('Not allowed by CORS'));
}
