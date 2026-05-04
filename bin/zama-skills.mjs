#!/usr/bin/env node
// Phase 1: use tsx to run TypeScript source directly. Phase 6 may switch to dist/cli/index.js.
//
// Hardening: resolve `tsx` from THIS package's own node_modules (declared devDep),
// then exec node directly with shell:false on every platform. This avoids:
//   - silently downloading `tsx` via `npx --yes` (supply-chain widening),
//   - argv being interpreted by cmd.exe on Windows (`shell: true` + injection chars).
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliEntry = path.resolve(here, '..', 'src', 'cli', 'index.ts');

const require = createRequire(import.meta.url);
let tsxCli;
try {
  tsxCli = require.resolve('tsx/cli');
} catch {
  console.error('zama-skills: required dependency "tsx" not found in package install. Try: npm i -g zama-skills, or open an issue at github.com/kocaemre/zama-skills.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [tsxCli, cliEntry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false,
});
process.exit(result.status ?? 1);
