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
