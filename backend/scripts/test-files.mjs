import fs from 'node:fs';
import path from 'node:path';

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

export function findTestFiles(root, relativeDirectory) {
  const directory = path.resolve(root, relativeDirectory);
  if (!fs.existsSync(directory)) {
    throw new Error(`Test directory does not exist: ${relativeDirectory}`);
  }

  const files = walk(directory)
    .filter(file => file.endsWith('.test.ts'))
    .map(file => path.relative(root, file))
    .sort();

  if (files.length === 0) {
    throw new Error(`No test files found under ${relativeDirectory}`);
  }

  return files;
}

export function printTestFiles(label, files) {
  console.log(`[${label}] Discovered ${files.length} test files:`);
  for (const file of files) console.log(`  - ${file}`);
}
