import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHealthResponse, getHealthCommit } from './health.service';

test('health response exposes safe version metadata', () => {
  const response = buildHealthResponse(new Date('2026-07-11T12:00:00.000Z'));

  assert.equal(response.status, 'ok');
  assert.equal(response.service, 'worker-backend');
  assert.equal(response.version, '1.0.0');
  assert.equal(typeof response.commit, 'string');
  assert.equal(response.ts, '2026-07-11T12:00:00.000Z');
});

test('health commit prefers Render commit environment variable', () => {
  const originalRender = process.env.RENDER_GIT_COMMIT;
  const originalGit = process.env.GIT_COMMIT;
  const originalSha = process.env.COMMIT_SHA;

  process.env.RENDER_GIT_COMMIT = 'render-commit';
  process.env.GIT_COMMIT = 'git-commit';
  process.env.COMMIT_SHA = 'sha-commit';

  try {
    assert.equal(getHealthCommit(), 'render-commit');
  } finally {
    process.env.RENDER_GIT_COMMIT = originalRender;
    process.env.GIT_COMMIT = originalGit;
    process.env.COMMIT_SHA = originalSha;
  }
});

test('health response does not expose known secret environment values', () => {
  const responseText = JSON.stringify(buildHealthResponse());

  assert.equal(responseText.includes('DATABASE_URL'), false);
  assert.equal(responseText.includes('JWT_ACCESS_SECRET'), false);
  assert.equal(responseText.includes('JWT_REFRESH_SECRET'), false);
  assert.equal(responseText.includes('CLOUDINARY_API_SECRET'), false);
});
