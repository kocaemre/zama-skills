---
phase: 04-other-4-skills
plan: 05
subsystem: shared-helpers
tags: [phase4, shared, preflight, closing-summary, tdd]
requires: []
provides:
  - "skills/_lib/preflight-shared.ts (detectWorkspace, checkPnpm, readPkgJson)"
  - "skills/_lib/closing-summary.ts (renderClosingSummary)"
  - "shared/prompts/closing-summary-{contract,test,deploy,frontend}.md"
affects: [phase4-skills-01-04]
tech-stack:
  added: []
  patterns:
    - "Single-source-of-truth for Phase 4 skills' preflight + closing summary"
    - "{{placeholder}} substitution with unknown-key preservation"
    - "@sync:prompt:closing-summary-<skill> transclusion convention"
key-files:
  created:
    - plugins/zama-skills/skills/_lib/preflight-shared.ts
    - plugins/zama-skills/skills/_lib/closing-summary.ts
    - plugins/zama-skills/skills/_lib/preflight-shared.test.ts
    - plugins/zama-skills/shared/prompts/closing-summary-contract.md
    - plugins/zama-skills/shared/prompts/closing-summary-test.md
    - plugins/zama-skills/shared/prompts/closing-summary-deploy.md
    - plugins/zama-skills/shared/prompts/closing-summary-frontend.md
  modified: []
decisions:
  - "Renderer preserves unknown placeholders verbatim (don't blank silently — authors notice missing data)"
  - "Lowercase {{key}} placeholder syntax per plan spec (existing closing-summary.md uses uppercase {{KEY}}; the new per-skill fragments are independent)"
  - "checkPnpm exposed as standalone export so skill-specific preflight scripts can compose without re-importing detectWorkspace"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-03"
  tasks: 2
  files: 7
---

# Phase 4 Plan 05: Shared Helpers Summary

Extracted Phase 4's shared preflight + closing-summary logic into `plugins/zama-skills/skills/_lib/`, plus 4 per-skill markdown fragments encoding the contract→test→deploy→frontend→ship navigation chain as the single source of truth.

## What Was Built

### Modules (`skills/_lib/`)

- **`preflight-shared.ts`** — three exports:
  - `detectWorkspace(cwd?)` — walks up looking for `pnpm-workspace.yaml`, returns `{ root, isPnpm, hasPackagesContracts, hasPackagesFrontend }`
  - `checkPnpm(cmd?)` — runs `<cmd> --version` via `spawnSync`, returns boolean
  - `readPkgJson(absPath)` — parses package.json, returns `PkgJson | null`
- **`closing-summary.ts`** — `renderClosingSummary(skill, vars, opts?)`:
  - Resolves `shared/prompts/closing-summary-<skill>.md` from `import.meta.url`
  - Substitutes `{{key}}` only when `key` is present in `vars` (preserves unknown placeholders)
  - Throws on unknown skill names

### Fragments (`shared/prompts/`)

| Fragment | Chain pointer |
|----------|---------------|
| `closing-summary-contract.md` | Next: `/zama-test` |
| `closing-summary-test.md` | Next: `/zama-deploy` |
| `closing-summary-deploy.md` | Next: `/zama-frontend` |
| `closing-summary-frontend.md` | Ship — `pnpm dev` → Vercel |

Each fragment uses `{{placeholder}}` for runtime substitution by `closing-summary.ts` AND will be inlined into the matching SKILL.md by the Phase 2 transclusion engine via `@sync:prompt:closing-summary-<skill>` markers.

### Tests (`preflight-shared.test.ts`)

14 vitest cases — workspace detection (3), pnpm check (2), pkg-json reader (3), closing-summary renderer (6, including unknown-skill throw and unknown-placeholder preservation).

## Verification

```
pnpm vitest run plugins/zama-skills/skills/_lib/preflight-shared.test.ts
→ PASS (14)  FAIL (0)
```

Plan Task 2 grep verifier:
```
node -e "...checks /zama-test, /zama-deploy, /zama-frontend, ship..."
→ all 4 fragments verified
```

Chain verification:
- contract fragment contains `/zama-test` ✓
- test fragment contains `/zama-deploy` ✓
- deploy fragment contains `/zama-frontend` ✓
- frontend fragment contains "ship" ✓

## TDD Gate Compliance

- RED: `f574806` test(04-05): add failing tests …  (test file alone, modules absent → load failure)
- GREEN: `8da8d77` feat(04-05): implement preflight-shared and closing-summary helpers (modules + fragments make all 14 tests pass)
- Task 2 commit: `895a0ca` docs(04-05): author 4 closing-summary fragments

Note: GREEN commit + Task 2 fragments commit are paired — fragments must exist for the renderer's read to succeed; both authored together but committed atomically as Task 1 (modules) and Task 2 (fragments).

## Deviations from Plan

None — plan executed as written. Tests, modules, and fragments match the `<interfaces>` contract exactly.

## Self-Check: PASSED

- `plugins/zama-skills/skills/_lib/preflight-shared.ts` — FOUND
- `plugins/zama-skills/skills/_lib/closing-summary.ts` — FOUND
- `plugins/zama-skills/skills/_lib/preflight-shared.test.ts` — FOUND
- `plugins/zama-skills/shared/prompts/closing-summary-contract.md` — FOUND
- `plugins/zama-skills/shared/prompts/closing-summary-test.md` — FOUND
- `plugins/zama-skills/shared/prompts/closing-summary-deploy.md` — FOUND
- `plugins/zama-skills/shared/prompts/closing-summary-frontend.md` — FOUND
- Commit `f574806` (RED test) — FOUND
- Commit `8da8d77` (GREEN modules) — FOUND
- Commit `895a0ca` (Task 2 fragments) — FOUND
