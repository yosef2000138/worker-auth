import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { findTestFiles, printTestFiles } from './test-files.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testFiles = findTestFiles(root, 'src');
printTestFiles('unit', testFiles);

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...testFiles],
  { cwd: root, env: process.env, stdio: 'inherit' },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
