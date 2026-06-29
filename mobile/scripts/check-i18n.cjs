const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const localeDir = path.join(root, 'src', 'i18n', 'locales');
const languages = ['en', 'ar', 'he', 'ru'];
const keyPattern = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;

function loadLocale(language) {
  const filePath = path.join(localeDir, `${language}.ts`);
  const source = fs.readFileSync(filePath, 'utf8')
    .replace(`export const ${language} =`, `const ${language} =`)
    .replace(/\s+as const;\s*$/, ';');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nglobalThis.locale = ${language};`, sandbox);
  return sandbox.locale;
}

function findNestingConflicts(keys) {
  const keySet = new Set(keys);
  const conflicts = [];

  for (const key of keys) {
    const parts = key.split('.');
    for (let index = 1; index < parts.length; index += 1) {
      const parent = parts.slice(0, index).join('.');
      if (keySet.has(parent)) {
        conflicts.push(`${parent} conflicts with ${key}`);
      }
    }
  }

  return conflicts;
}

const locales = Object.fromEntries(languages.map(language => [language, loadLocale(language)]));
const baseKeys = Object.keys(locales.en).sort();
const baseSet = new Set(baseKeys);
const failures = [];

for (const language of languages) {
  const keys = Object.keys(locales[language]).sort();
  const keySet = new Set(keys);
  const missing = baseKeys.filter(key => !keySet.has(key));
  const extra = keys.filter(key => !baseSet.has(key));
  const malformed = keys.filter(key => !keyPattern.test(key));
  const nestingConflicts = findNestingConflicts(keys);

  if (missing.length || extra.length || malformed.length || nestingConflicts.length) {
    failures.push({ language, missing, extra, malformed, nestingConflicts });
  }
}

if (failures.length) {
  console.error('[i18n] Translation check failed');
  for (const result of failures) {
    console.error(`\n${result.language}:`);
    if (result.missing.length) console.error(`  Missing keys:\n    ${result.missing.join('\n    ')}`);
    if (result.extra.length) console.error(`  Extra keys:\n    ${result.extra.join('\n    ')}`);
    if (result.malformed.length) console.error(`  Malformed keys:\n    ${result.malformed.join('\n    ')}`);
    if (result.nestingConflicts.length) console.error(`  Nesting conflicts:\n    ${result.nestingConflicts.join('\n    ')}`);
  }
  process.exit(1);
}

console.log(`[i18n] ${baseKeys.length} keys verified across ${languages.join(', ')}`);
