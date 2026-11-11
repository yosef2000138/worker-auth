import { db } from '../../config/database';
import { checkRedisConnection } from '../../config/redis';

const SERVICE_NAME = 'worker-backend';
const VERSION = '1.0.0';

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find(value => typeof value === 'string' && value.trim().length > 0)?.trim();
}

export function getHealthCommit() {
  return firstNonEmpty(
    process.env.RENDER_GIT_COMMIT,
    process.env.GIT_COMMIT,
    process.env.COMMIT_SHA,
  ) ?? 'unknown';
}

export function buildHealthResponse(now = new Date()) {
  return {
    status: 'ok',
    service: SERVICE_NAME,
    environment: process.env.NODE_ENV ?? 'development',
    version: VERSION,
    commit: getHealthCommit(),
    buildTime: firstNonEmpty(
      process.env.BUILD_TIME,
      process.env.RENDER_BUILD_TIMESTAMP,
    ) ?? 'unknown',
    ts: now.toISOString(),
  };
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number) {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Dependency check timed out')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function buildReadinessResponse(timeoutMs = 2_000) {
  const [database, redis] = await Promise.allSettled([
    withTimeout(db.$queryRaw`SELECT 1`, timeoutMs),
    withTimeout(checkRedisConnection(), timeoutMs),
  ]);
  const databaseReady = database.status === 'fulfilled';
  const redisReady = redis.status === 'fulfilled' && redis.value;

  return {
    status: databaseReady && redisReady ? 'ready' : 'not_ready',
    service: SERVICE_NAME,
    commit: getHealthCommit(),
    dependencies: {
      database: databaseReady ? 'up' : 'down',
      redis: redisReady ? 'up' : 'down',
    },
    ts: new Date().toISOString(),
  };
}
