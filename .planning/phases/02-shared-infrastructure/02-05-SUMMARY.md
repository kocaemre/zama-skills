---
phase: 02-shared-infrastructure
plan: 05
subsystem: validate-ci
tags: [ci, validate, sync, drift, vitest]
requires: [02-01, 02-02, 02-03, 02-04]
provides: [pnpm-sync, pnpm-sync-check, validate-drift-gate]
affects: [scripts/validate.ts, scripts/build.ts, package.json, .github/workflows/ci.yml]
key-files:
  created:
    - scripts/validate.test.ts
  modified:
    - scripts/validate.ts
    - scripts/build.ts
    - package.json
    - .github/workflows/ci.yml
decisions:
  - "validate.ts imports runSync directly (no subprocess spawn) for speed and so a single test can reach both"
  - "runSync now accepts cwd?: string so tests can mutate a copied fixture without process.chdir (NICE-TO-HAVE N1)"
  - "validate.ts wrapped in invokedDirect guard to make it safely importable from tests"
  - "Drift check is on by default in validate.ts; --skip-sync flag bypasses it for manifest-only runs"
metrics:
  duration: ~25min
  completed: 2026-05-03
---

# Phase 2 Plan 5: validate-ci Summary

`pnpm validate` is now the single CI entrypoint covering both Phase-1 manifest schema and Phase-2 sync drift. Maintainers and CI both run the same gate; new `pnpm sync` / `pnpm sync:check` scripts surface the build engine for local use.

## What Changed

| File | Change |
|------|--------|
| `scripts/validate.ts` | Imports `runSync` from `./build.js`; new `runSyncCheck()`; runs drift check after manifest validation; emits canonical `Drift detected. Run \`pnpm sync\` and commit the result.` on failure; `--skip-sync` flag; `invokedDirect` guard for test-importable surface |
| `scripts/build.ts` | `runSync` now accepts `{ check, cwd? }`; all dir/path logic threaded through a `Dirs` struct so tests can drive a temp fixture |
| `package.json` | Added `sync` and `sync:check` scripts |
| `scripts/validate.test.ts` | New: 4 vitest cases (in-sync, drifted SKILL.md, subprocess exit-1 on drift, subprocess exit-0 clean) |
| `.github/workflows/ci.yml` | Added comment on validate step noting it now also runs the drift check |

## npm Script Surface

```bash
pnpm sync          # write changes to disk (regenerates SKILL.md + generic/*)
pnpm sync:check    # read-only drift check; exit 1 on drift
pnpm validate      # zod manifest validation + sync drift check (CI gate)
pnpm validate -- --skip-sync   # manifest-only (debugging)
```

## Canonical Drift Message

```
Drift detected. Run `pnpm sync` and commit the result.
```

Emitted by both `scripts/build.ts` (when invoked directly) and `scripts/validate.ts` (when `runSyncCheck()` returns errors).

## Test Results

- `pnpm validate` → exit 0
- `pnpm sync:check` → exit 0
- `pnpm typecheck` → 0 errors
- `pnpm test` → 29 / 29 passed across 3 files (markers 13, versions 12, validate 4)

## CI Status

`.github/workflows/ci.yml` already runs `npm run validate` as the mandatory gate — no structural change needed. The validate step now also fails on sync drift; comment added inline.

Existing `Best-effort — official Claude plugin validate CLI` step is unchanged (Phase 6 follow-up).

## Deviations from Plan

**1. [Rule 3 - Blocking] `invokedDirect` guard added to validate.ts**
- **Found during:** Task 2 — vitest test imports `runSync` indirectly via validate.ts; bare `main()` call would have run on import.
- **Fix:** Wrapped `main()` in the same `invokedDirect` pattern that build.ts uses.
- **Files:** `scripts/validate.ts`
- **Commit:** `d056d5d`

**2. [Rule 3 - Blocking] Threaded `cwd` through build.ts as a real option (not just process.chdir)**
- **Found during:** Task 2.
- **Plan note:** Plan said "if needed, add cwd to build.ts" — added it. Cleaner tests, no global state mutation.
- **Files:** `scripts/build.ts`
- **Commit:** `d056d5d`

**3. [Rule 1 - Bug] Drift assertion targeted SKILL.md but drift surfaces via `generic/<skill>.md`**
- **Found during:** Task 2 first vitest run.
- **Issue:** Appending a sentinel after SKILL.md markers leaves SKILL.md untouched after re-transclusion (markers get refilled identically; the trailing sentinel survives, so on-disk = expected). The drift IS detected, just against the regenerated `generic/init.md` which is derived fresh from the SKILL.md body containing the sentinel.
- **Fix:** Loosened assertion to `errors.some((e) => e.includes("init"))`.
- **Files:** `scripts/validate.test.ts`
- **Commit:** `7d87580`

## Phase 2 Wave Recap (artifacts produced across 02-01 → 02-05)

- **02-01** `pinned-versions.json` + `deprecated-imports.json` under `plugins/zama-skills/shared/`
- **02-02** Shared snippets / prompts under `plugins/zama-skills/shared/{snippets,prompts}/`
- **02-03** `scripts/build.ts` sync engine with `runSync({ check })` API + `generic/<skill>.md` generator
- **02-04** Sync markers materialized inside the 5 SKILL.md skeletons + initial `generic/*` outputs
- **02-05 (this plan)** Wired drift check into `pnpm validate`, added `pnpm sync` / `pnpm sync:check`, added drift-detection vitest suite

## Self-Check: PASSED

- `scripts/validate.test.ts` — FOUND
- `scripts/validate.ts` — FOUND (contains runSyncCheck and "Drift detected" message)
- `package.json` — FOUND (contains sync + sync:check)
- Commit `d056d5d` — FOUND
- Commit `7d87580` — FOUND
