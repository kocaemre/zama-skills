#!/usr/bin/env node
// Phase 1: use tsx to run TypeScript source directly. Phase 6 may switch to dist/cli/index.js.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliEntry = path.resolve(here, '..', 'src', 'cli', 'index.ts');
const result = spawnSync('npx', ['--yes', 'tsx', cliEntry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
