import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaults = {
  NODE_ENV: 'test',
  PORT: '3001',
  DATABASE_URL: 'postgresql://worker_test:worker_test@127.0.0.1:5433/worker_test',
  REDIS_URL: 'redis://127.0.0.1:6380/15',
  JWT_ACCESS_SECRET: 'integration-access-secret-32-characters-minimum',
  JWT_REFRESH_SECRET: 'integration-refresh-secret-32-characters-minimum',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: '10',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1',
  SMTP_USER: 'integration',
  SMTP_PASS: 'integration',
  EMAIL_FROM: 'integration@worker.test',
  CLIENT_URL: 'http://127.0.0.1:8081',
  SUBSCRIPTIONS_ENABLED: 'false',
  WORKER_FREE_ACCEPTED_REQUEST_LIMIT: '20',
  MAX_OFFERS_PER_REQUEST: '5',
  CLOUDINARY_CLOUD_NAME: 'integration',
  CLOUDINARY_API_KEY: 'integration',
  CLOUDINARY_API_SECRET: 'integration',
};
const env = { ...defaults, ...process.env, NODE_ENV: 'test' };

function assertIsolatedDatabase() {
  const database = new URL(env.DATABASE_URL);
  const redis = new URL(env.REDIS_URL);
  const localHosts = new Set(['127.0.0.1', 'localhost', 'postgres', 'worker-test-postgres']);
  if (!localHosts.has(database.hostname) || !database.pathname.toLowerCase().endsWith('_test')) {
    throw new Error('Integration tests require a local PostgreSQL database whose name ends in _test.');
  }
  if (!localHosts.has(redis.hostname) || redis.pathname !== '/15') {
    throw new Error('Integration tests require local Redis database 15.');
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

assertIsolatedDatabase();
const executable = process.platform === 'win32' ? '.cmd' : '';
run(path.join(root, 'node_modules', '.bin', `tsc${executable}`), [
  '-p',
  'tsconfig.integration.json',
  '--noEmit',
]);
run(path.join(root, 'node_modules', '.bin', `prisma${executable}`), ['migrate', 'deploy']);
run(path.join(root, 'node_modules', '.bin', `tsx${executable}`), [
  '--test',
  '--test-concurrency=1',
  'test/integration/**/*.test.ts',
]);
