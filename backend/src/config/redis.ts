import crypto from 'crypto';
import { createClient } from 'redis';
import { env } from './env';
import { logger } from '../utils/logger';

type MemoryToken = {
  value: string;
  expiresAt: number;
};

export type OneTimeTokenPurpose = 'email-verification' | 'password-reset';

const memoryTokens = new Map<string, MemoryToken>();
let useMemoryStore = false;

const REFRESH_PREFIX = 'auth:refresh:';
const SESSION_PREFIX = 'auth:session:';
const ONE_TIME_PREFIX = 'auth:one-time:';

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
    logger.error('redis.error', { errorName: err.name });
    return;
  }

  if (!useMemoryStore) {
    logger.warn('redis.unavailable', { fallback: 'memory' });
  }
});

redis.on('connect', () => {
  logger.info('redis.connected');
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
    logger.warn('redis.memory_fallback.enabled');
  }
}

export async function checkRedisConnection() {
  if (!redis.isOpen) return false;
  return (await redis.ping()) === 'PONG';
}

export async function disconnectRedis() {
  if (redis.isOpen) await redis.quit();
}

function refreshKey(userId: string) {
  return `${REFRESH_PREFIX}${userId}`;
}

function sessionKey(userId: string) {
  return `${SESSION_PREFIX}${userId}`;
}

function oneTimeKey(purpose: OneTimeTokenPurpose, token: string) {
  return `${ONE_TIME_PREFIX}${purpose}:${hashToken(token)}`;
}

function oneTimeUserKey(purpose: OneTimeTokenPurpose, userId: string) {
  return `${ONE_TIME_PREFIX}${purpose}:user:${userId}`;
}

function oneTimeTokenPrefix(purpose: OneTimeTokenPurpose) {
  return `${ONE_TIME_PREFIX}${purpose}:`;
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
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
  if (redis.isOpen) return true;
  if (env.NODE_ENV === 'production') {
    throw new Error('Redis session store is unavailable');
  }
  return false;
}

function setMemoryValue(key: string, value: string, ttlSeconds: number) {
  memoryTokens.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function createSession(
  userId: string,
  sessionId: string,
  refreshToken: string,
  ttlSeconds: number,
) {
  const refreshDigest = hashToken(refreshToken);

  if (shouldUseRedis()) {
    await redis.multi()
      .set(sessionKey(userId), sessionId, { EX: ttlSeconds })
      .set(refreshKey(userId), refreshDigest, { EX: ttlSeconds })
      .exec();
    return;
  }

  setMemoryValue(sessionKey(userId), sessionId, ttlSeconds);
  setMemoryValue(refreshKey(userId), refreshDigest, ttlSeconds);
}

export async function isSessionActive(userId: string, sessionId: string): Promise<boolean> {
  if (shouldUseRedis()) {
    return (await redis.get(sessionKey(userId))) === sessionId;
  }

  return pruneExpired(sessionKey(userId))?.value === sessionId;
}

export async function rotateRefreshToken(
  userId: string,
  sessionId: string,
  currentRefreshToken: string,
  nextRefreshToken: string,
  ttlSeconds: number,
): Promise<boolean> {
  const currentDigest = hashToken(currentRefreshToken);
  const nextDigest = hashToken(nextRefreshToken);

  if (shouldUseRedis()) {
    const result = await redis.eval(
      `
        if redis.call('GET', KEYS[1]) ~= ARGV[1] then
          return 0
        end
        if redis.call('GET', KEYS[2]) ~= ARGV[2] then
          return 0
        end
        redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[4])
        redis.call('EXPIRE', KEYS[1], ARGV[4])
        return 1
      `,
      {
        keys: [sessionKey(userId), refreshKey(userId)],
        arguments: [sessionId, currentDigest, nextDigest, String(ttlSeconds)],
      },
    );
    return Number(result) === 1;
  }

  const storedSession = pruneExpired(sessionKey(userId));
  const storedRefresh = pruneExpired(refreshKey(userId));
  if (storedSession?.value !== sessionId || storedRefresh?.value !== currentDigest) {
    return false;
  }

  setMemoryValue(sessionKey(userId), sessionId, ttlSeconds);
  setMemoryValue(refreshKey(userId), nextDigest, ttlSeconds);
  return true;
}

export async function revokeSession(userId: string) {
  if (shouldUseRedis()) {
    await redis.del([sessionKey(userId), refreshKey(userId)]);
    return;
  }

  memoryTokens.delete(sessionKey(userId));
  memoryTokens.delete(refreshKey(userId));
}

export async function storeOneTimeToken(
  purpose: OneTimeTokenPurpose,
  token: string,
  userId: string,
  ttlSeconds: number,
) {
  const key = oneTimeKey(purpose, token);
  const digest = hashToken(token);
  const userKey = oneTimeUserKey(purpose, userId);
  if (shouldUseRedis()) {
    await redis.eval(
      `
        local oldDigest = redis.call('GET', KEYS[2])
        if oldDigest then
          redis.call('DEL', ARGV[1] .. oldDigest)
        end
        redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[4])
        redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[4])
        return 1
      `,
      {
        keys: [key, userKey],
        arguments: [oneTimeTokenPrefix(purpose), userId, digest, String(ttlSeconds)],
      },
    );
    return;
  }

  const previousDigest = pruneExpired(userKey)?.value;
  if (previousDigest) memoryTokens.delete(`${oneTimeTokenPrefix(purpose)}${previousDigest}`);
  setMemoryValue(key, userId, ttlSeconds);
  setMemoryValue(userKey, digest, ttlSeconds);
}

export async function consumeOneTimeToken(
  purpose: OneTimeTokenPurpose,
  token: string,
): Promise<string | null> {
  const key = oneTimeKey(purpose, token);
  const digest = hashToken(token);
  if (shouldUseRedis()) {
    const result = await redis.eval(
      `
        local userId = redis.call('GET', KEYS[1])
        if not userId then
          return false
        end
        local userKey = ARGV[1] .. userId
        if redis.call('GET', userKey) ~= ARGV[2] then
          return false
        end
        redis.call('DEL', KEYS[1])
        redis.call('DEL', userKey)
        return userId
      `,
      {
        keys: [key],
        arguments: [`${oneTimeTokenPrefix(purpose)}user:`, digest],
      },
    );
    return typeof result === 'string' ? result : null;
  }

  const stored = pruneExpired(key);
  const userKey = stored ? oneTimeUserKey(purpose, stored.value) : null;
  if (!stored || !userKey || pruneExpired(userKey)?.value !== digest) {
    return null;
  }
  memoryTokens.delete(key);
  memoryTokens.delete(userKey);
  return stored.value;
}
