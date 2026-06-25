import { createClient } from 'redis';
import { env } from './env';

export const redis = createClient({ url: env.REDIS_URL });

redis.on('error', (err) => console.error('Redis error:', err));
redis.on('connect', () => console.log('✅ Redis connected'));

export async function connectRedis() {
  await redis.connect();
}

// Refresh token helpers
const REFRESH_PREFIX = 'refresh:';

export async function storeRefreshToken(userId: string, token: string, ttlSeconds: number) {
  await redis.set(`${REFRESH_PREFIX}${userId}`, token, { EX: ttlSeconds });
}

export async function getRefreshToken(userId: string): Promise<string | null> {
  return redis.get(`${REFRESH_PREFIX}${userId}`);
}

export async function deleteRefreshToken(userId: string) {
  await redis.del(`${REFRESH_PREFIX}${userId}`);
}
