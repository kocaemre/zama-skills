---
phase: 01-plugin-foundation-ci
plan: 03
subsystem: npm-package-cli
tags: [npm, cli, typescript, commander, bin-shim, foundation]
requires:
  - .claude-plugin/marketplace.json (from 01-01)
  - plugins/zama-skills/plugin.json (from 01-01)
provides:
  - npm-package-skeleton
  - bin-shim-zama-skills
  - cli-install-stub
  - typescript-strict-config
affects:
  - future-plan-01-04 (CI consumes package.json scripts: typecheck, validate, test)
  - future-phase-06 (PLUGIN-05 fills in real fs install logic atop this stub)
tech-stack:
  added:
    - commander@^12.1.0
    - fs-extra@^11.2.0
    - picocolors@^1.1.1
    - prompts@^2.4.2
    - typescript@^5.9.3
    - tsx@^4.21.0
    - vitest@^2.1.9
    - zod@^3.25.0
    - "@types/node@^20.19.30"
    - "@types/fs-extra@^11.0.4"
    - "@types/prompts@^2.4.9"
  patterns:
    - "ESM-first npm package (type: module + .mjs bin shim)"
    - "tsx-loader bin shim (no build step in Phase 1; spawns npx tsx <ts-entry>)"
    - "files allowlist (whitelist what ships, exclude .planning/, .github/, tsconfig.json)"
    - "strict TS NodeNext for Node 20 ESM"
key-files:
  created:
    - path: package.json
      role: npm metadata + bin field + dev/runtime deps
      depends-on: []
    - path: tsconfig.json
      role: strict TS compiler config (ESM NodeNext, noEmit)
      depends-on: []
    - path: bin/zama-skills.mjs
      role: executable shim (shebang) that spawns tsx against src/cli/index.ts
      depends-on: [src/cli/index.ts]
    - path: src/cli/index.ts
      role: commander-based CLI with `install` subcommand stub
      depends-on: [package.json]
  modified: []
decisions:
  - "Pinned `version: 0.0.0-dev` placeholder so package.json is well-formed for any tooling that requires it; submission will bump to 0.1.0 in Phase 6"
  - "Used commander ^12 / zod ^3 / vitest ^2 verbatim per CLAUDE.md, rejecting RESEARCH.md's newer-major suggestions"
  - "Bin shim spawns `npx --yes tsx` instead of a built dist/ entry — keeps Phase 1 buildless and robust against missing dist/"
  - "Phase 1 install stub prints /plugin marketplace add commands only — zero fs writes, deferred to Phase 6 PLUGIN-05 per threat model T-01-06"
metrics:
  duration-seconds: 114
  tasks-completed: 3
  files-created: 4
  files-modified: 0
  commits: 3
  completed: 2026-05-03
---

# Phase 1 Plan 3: npm Package + CLI Stub + tsconfig Summary

**One-liner:** npm package skeleton with `commander`-based `install` CLI stub, bin shim using tsx loader (no build step), and strict TypeScript NodeNext config for Node 20 ESM.

## What Was Built

Three foundation files that satisfy the "judge can install via npm fallback" half of PLUGIN-01 and unlock the CI work in plan 01-04:

1. **`package.json`** — npm metadata with all deps pinned per CLAUDE.md (`commander ^12`, `zod ^3`, `vitest ^2`, `prompts ^2`, `picocolors ^1.1.1`, `fs-extra ^11`, `typescript ^5.9.3`). `engines.node: >=20`. `bin.zama-skills` → `./bin/zama-skills.mjs`. `files` allowlist scopes the published surface to `bin`, `src`, `scripts`, `plugins`, `.claude-plugin`, `README.md`, `LICENSE`.
2. **`tsconfig.json`** — strict ESM NodeNext (target ES2022, `module + moduleResolution: NodeNext`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `isolatedModules`, `noEmit: true`). Excludes `plugins/` and `.planning/` from type-checking surface.
3. **`bin/zama-skills.mjs` + `src/cli/index.ts`** — executable shim spawns `npx --yes tsx` against the TS entry; commander stub registers `install` subcommand with `--scope` flag. Action prints recommended `/plugin marketplace add` and `/plugin install zama-skills@zama-skills` commands (no filesystem writes in Phase 1).

## Tasks Completed

| Task | Name                                     | Commit  | Files                                  |
| ---- | ---------------------------------------- | ------- | -------------------------------------- |
| 1    | package.json with pinned deps + bin shim | 0d96345 | package.json                           |
| 2    | tsconfig.json (strict ESM Node 20)       | 6bfff65 | tsconfig.json                          |
| 3    | bin shim + commander CLI stub            | 1232bfb | bin/zama-skills.mjs, src/cli/index.ts  |

## Verification Results

- `package.json` parses as valid JSON; all 14 shape checks pass (name, type, bin, engines, all 7 version pins matching CLAUDE.md, files allowlist exact match)
- `tsconfig.json` parses as valid JSON; all 7 shape checks pass (strict, NodeNext module + resolution, target ES2022, noUncheckedIndexedAccess, include/exclude correct)
- `bin/zama-skills.mjs` is executable (`x` bit set), starts with `#!/usr/bin/env node`, passes `node --check` (valid ESM syntax)
- `src/cli/index.ts` contains required patterns: `Command` import, `.command('install')`, `.option('--scope ...)`, prints `/plugin marketplace add` and `zama-skills@zama-skills`

`npm install`, `npx tsc --noEmit`, and runtime CLI exercise (`npx tsx src/cli/index.ts install`) were intentionally skipped per orchestrator instructions (network/env constraints; node_modules not populated). These will be exercised in CI by plan 01-04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `version: 0.0.0-dev` field to package.json**
- **Found during:** Task 1
- **Issue:** Plan said "try without version field first; add `0.0.0-dev` placeholder if `npm install` complains." Since `npm install` is intentionally skipped under these execution constraints, leaving the field out would defer the failure into the CI workflow (plan 01-04) where it would block validation.
- **Fix:** Added `"version": "0.0.0-dev"` proactively (the plan permits this fallback). Phase 6 PLUGIN-05 bumps to `0.1.0` at submission.
- **Files modified:** package.json
- **Commit:** 0d96345

No other deviations. Auto-mode considered: not applicable (no checkpoints in this plan).

## Authentication Gates

None encountered.

## Threat Surface Scan

No new security-relevant surface beyond what is already covered in the plan's `<threat_model>`:
- T-01-06 (install subcommand fs writes): mitigated — stub prints commands only; zero fs writes in Phase 1.
- T-01-DEPS (supply chain): mitigated structurally — all majors pinned per CLAUDE.md; lockfile generation deferred to first `npm install` (plan 01-04 CI uses `npm ci` lockfile-strict).
- T-01-PJSON (over-share via `files`): mitigated — strict allowlist excludes `.planning/`, `.github/`, `tsconfig.json`, tests.
- T-01-SHIM (Windows DoS): accepted as documented; `spawnSync` uses `shell: win32`.

No threat flags.

## Known Stubs

**Intentional, scoped to Phase 1:**

- `src/cli/index.ts` `install` action prints recommended `/plugin marketplace add` + `/plugin install` commands and does NOT write anything to disk. This is the documented Phase 1 stub behavior (plan objective explicitly says "Phase 1: prints recommended /plugin marketplace add commands"). Real fs install logic lands in Phase 6 PLUGIN-05.
- `version: "0.0.0-dev"` placeholder — submission task in Phase 6 bumps to `0.1.0`.

## Deferred Items

- Running `npm install` to generate `package-lock.json` (deferred to plan 01-04 CI environment).
- Running `npx tsc --noEmit` and `npx tsx src/cli/index.ts install` smoke tests (deferred to plan 01-04 CI workflow).
- Build step (`tsc` emit to `dist/`) — Phase 6 may flip `noEmit: false` if publish size matters.

## Self-Check: PASSED

- FOUND: /Users/0xemrek/Desktop/bounty-zama/package.json
- FOUND: /Users/0xemrek/Desktop/bounty-zama/tsconfig.json
- FOUND: /Users/0xemrek/Desktop/bounty-zama/bin/zama-skills.mjs (executable)
- FOUND: /Users/0xemrek/Desktop/bounty-zama/src/cli/index.ts
- FOUND commit: 0d96345 (Task 1, package.json)
- FOUND commit: 6bfff65 (Task 2, tsconfig.json)
- FOUND commit: 1232bfb (Task 3, bin shim + CLI stub)
