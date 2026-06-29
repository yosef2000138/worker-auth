import { createClient } from 'redis';
import { env } from './env';

type MemoryToken = {
  value: string;
  expiresAt: number;
};

const memoryTokens = new Map<string, MemoryToken>();
let useMemoryStore = false;

export const redis = createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: env.NODE_ENV === 'production'
      ? retries => Math.min(retries * 250, 5_000)
      : false,
  },
});

redis.on('error', (err) => {
  if (env.NODE_ENV === 'production') {
    console.error('Redis error:', err.message);
    return;
  }

  if (!useMemoryStore) {
    console.warn('Redis unavailable locally:', err.message);
  }
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

export async function connectRedis() {
  try {
    if (!redis.isOpen) {
      await redis.connect();
    }
  } catch (error) {
    if (env.NODE_ENV === 'production') {
      throw error;
    }

    useMemoryStore = true;
    console.warn('⚠️ Redis is not reachable. Using in-memory token storage for local development.');
  }
}

function memoryKey(userId: string) {
  return `${REFRESH_PREFIX}${userId}`;
}

function pruneExpired(key: string) {
  const item = memoryTokens.get(key);
  if (item && item.expiresAt <= Date.now()) {
    memoryTokens.delete(key);
    return null;
  }

  return item ?? null;
}

function shouldUseRedis() {
  return !useMemoryStore && redis.isOpen;
}

// Refresh token helpers
const REFRESH_PREFIX = 'refresh:';

export async function storeRefreshToken(userId: string, token: string, ttlSeconds: number) {
  if (shouldUseRedis()) {
    await redis.set(memoryKey(userId), token, { EX: ttlSeconds });
    return;
  }

  memoryTokens.set(memoryKey(userId), {
    value: token,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function getRefreshToken(userId: string): Promise<string | null> {
  if (shouldUseRedis()) {
    return redis.get(memoryKey(userId));
  }

  return pruneExpired(memoryKey(userId))?.value ?? null;
}

export async function deleteRefreshToken(userId: string) {
  if (shouldUseRedis()) {
    await redis.del(memoryKey(userId));
    return;
  }

  memoryTokens.delete(memoryKey(userId));
}
