---
phase: 06-distribution-submission
plan: 04-npm-package
subsystem: distribution
tags: [npm, cli, commander, fs-extra, prompts, vitest, tdd]
provides:
  - publishable npm manifest (zama-skills@0.1.0) with explicit files whitelist + prepublishOnly gate
  - real `zama-skills install` CLI copying 5 skill bundles into ~/.claude/skills/zama-skills/ or ./.claude/skills/zama-skills/
  - 5 vitest cases covering scope=personal, scope=project, force overwrite, return shape, empty source error
  - LICENSE (MIT, Emre Koca 2026) confirmed at repo root
  - tarball verified clean (94 files, 120.5 kB; no .planning/.claude/examples leaked)
affects: [06-05-final-readme, post-bounty-publish-flow]
tech-stack:
  added: []
  patterns:
    - "TDD RED→GREEN: failing import test, then implementation"
    - "ESM .js suffix on TS imports (tsx + vitest resolve)"
    - "files whitelist over .npmignore (deny-by-default packaging)"
    - "prepublishOnly gate: validate + test + generic:check"
key-files:
  created:
    - src/cli/install.ts
    - src/cli/install.test.ts
    - .planning/phases/06-distribution-submission/06-04-SUMMARY.md
  modified:
    - package.json
    - src/cli/index.ts
key-decisions:
  - "Use fs-extra.copy with overwrite/errorOnExist gated by force flag (not manual recursion)"
  - "Resolve sourceRoot via fileURLToPath so it works from both repo run and installed npm package"
  - "Prompt overwrite confirmation only when destination has existing entries (not on first run)"
  - "Bin layout unchanged (./bin/zama-skills.mjs spawns tsx on src/cli/index.ts) — keeps Phase-1 ergonomics"
duration: 18min
completed: 2026-05-04
---

# Phase 06 Plan 04: NPM Package Polish + Real Install CLI Summary

**Made `zama-skills` publishable to npm with a working `npx zama-skills install` CLI that actually copies skill bundles (PLUGIN-05 + DIST-04 prep complete; user runs `npm publish`).**

## Performance
- **Duration:** ~18 min
- **Tasks:** 3 of 4 complete (Task 4 = checkpoint:human-action — user runs `npm publish`)
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- TDD RED→GREEN cycle for install CLI: 5 tests added, all green
- Real `installSkills()` API + commander `install` action wired (personal | project scope, --force flag, prompts overwrite confirmation)
- package.json bumped 0.0.0-dev → 0.1.0; `<owner>` placeholders replaced with `kocaemre`; `bugs.url` added; explicit `files` whitelist; `prepublishOnly` gate (`validate && test && generic:check`)
- LICENSE present at repo root (MIT, Emre Koca 2026) — confirmed
- `npm pack --dry-run`: 94 files, 120.5 kB, includes bin/, src/cli, plugins/zama-skills/skills/ (with all 5 SKILL.md), .claude-plugin/marketplace.json, generic/*.md, README, LICENSE, THIRD_PARTY_LICENSES — no .planning/.claude/examples leaked
- Manual smoke: `node bin/zama-skills.mjs install --scope project --force` writes 5 skill bundles to tmp dir, prints colored next-steps

## Task Commits
1. **Task 1: RED tests for install CLI** - `1982e45`
2. **Task 2: real install CLI copies skill bundles** - `e75491a`
3. **Task 3: polish package.json for npm publish** - `6be365f`
4. **Task 4: User runs `npm publish`** - PENDING (checkpoint:human-action — see "Awaiting User" below)

## Files Created/Modified
- `src/cli/install.ts` (created) — `installSkills({ scope, targetRoot, sourceRoot, force })` using fs-extra.copy; throws if source has no `<dir>/SKILL.md`; returns `{ written, scope, target }`. Plus `destinationHasExisting()` helper for overwrite-prompt gating.
- `src/cli/install.test.ts` (created) — 5 vitest cases against the real `plugins/zama-skills/skills/` source tree using tmp dirs.
- `src/cli/index.ts` (modified) — replaced Phase-1 stub with real commander action; added prompts confirm flow; resolves sourceRoot via `fileURLToPath` so installed package works.
- `package.json` (modified) — version 0.1.0, kocaemre URLs, bugs field, explicit files whitelist, prepublishOnly gate, +2 keywords.
- `LICENSE` (pre-existing) — MIT, Emre Koca 2026, no changes needed.

## Decisions & Deviations

**Deviations:** None — plan executed exactly as written. No Rule 1/2/3 auto-fixes triggered.

**Notable design choices:**
- `errorOnExist: !force` in `fs-extra.copy` means CLI safely refuses to clobber unless user opts in (or prompt-confirms). The `destinationHasExisting()` probe runs before copy so the prompt fires once for the whole tree, not per-file.
- `--scope project` uses `process.cwd()` not `path.resolve('.')` — matches plan spec and matches user mental model when invoked via `npx`.
- Tests import the **real** bundled `plugins/zama-skills/skills/` (5 skills) rather than mocking — keeps RED→GREEN tied to actual production layout.

## Awaiting User

**Task 4 — `checkpoint:human-action`:** User runs `npm publish` interactively (npm CLI cannot be automated for first-time publish + 2FA).

Steps for the user:
1. `npm whoami` (login if needed: `npm login`)
2. `npm view zama-skills version` — confirm name is free (404 = available)
3. `npm publish --dry-run` — final inspection
4. `npm publish --access public`
5. Verify: `npm view zama-skills version` → `0.1.0`
6. Smoke from outside repo: `cd $(mktemp -d) && npx zama-skills@0.1.0 install --scope project --force` → expect `.claude/skills/zama-skills/init/SKILL.md`
7. Report back the published version + tarball URL (`npm view zama-skills dist.tarball`)

## Next Phase Readiness
- Plan 06-05 (final README polish) can reference live `npm install zama-skills` install path once user publishes.
- DIST-04 + PLUGIN-05 requirements satisfied on the Claude side; final tick happens when user reports `npm publish` success.

## Self-Check: PASSED
- src/cli/install.ts — FOUND
- src/cli/install.test.ts — FOUND
- src/cli/index.ts — FOUND (modified)
- package.json — FOUND (version 0.1.0)
- LICENSE — FOUND (MIT)
- Commits 1982e45, e75491a, 6be365f — FOUND in git log
- npm pack --dry-run — verified clean whitelist (no .planning/.claude/examples)
- vitest run src/cli/install.test.ts — 5/5 PASS
