import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(backendRoot, '..');
const composeFile = path.join(repositoryRoot, 'docker-compose.test.yml');
const composeArgs = [
  'compose',
  '--project-name',
  'worker-auth-integration-test',
  '-f',
  composeFile,
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    env: process.env,
    stdio: options.stdio ?? 'inherit',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (run('docker', ['info'], { stdio: 'ignore' }) !== 0) {
  console.error('Docker is not running. Start Docker Desktop, then retry npm run test:integration:docker.');
  process.exit(1);
}

let composeAttempted = false;
let exitCode = 1;

try {
  composeAttempted = true;
  exitCode = run('docker', [...composeArgs, 'up', '-d', '--wait']);
  if (exitCode === 0) {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    exitCode = run(npm, ['run', 'test:integration'], { cwd: backendRoot });
  }
} finally {
  if (composeAttempted) {
    const cleanupCode = run('docker', [...composeArgs, 'down', '--volumes', '--remove-orphans']);
    if (exitCode === 0 && cleanupCode !== 0) exitCode = cleanupCode;
  }
}

process.exit(exitCode);
