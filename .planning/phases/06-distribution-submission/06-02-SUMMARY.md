---
phase: 06
plan: 06-02-generic-docs-generator
subsystem: distribution
tags: [tooling, ci, docs, drift-detection]
requires: []
provides:
  - generic-docs-generator
  - generic-docs-drift-gate
affects:
  - scripts/build.ts (now delegates to canonical generator via lib/generic.ts)
tech-stack:
  added: []
  patterns:
    - "Single canonical generator (.mjs) + thin TS wrapper that delegates — no duplicated logic"
    - "Frontmatter bucket-and-rebuild with fixed key order for byte-deterministic output"
    - "git hash-object SHA stamping for source drift detection"
key-files:
  created:
    - scripts/generate-generic-docs.mjs
    - scripts/generate-generic-docs.test.mjs
    - generic/init.md (regenerated under new shape)
    - generic/contract.md (regenerated)
    - generic/test.md (regenerated)
    - generic/deploy.md (regenerated)
    - generic/frontend.md (regenerated)
  modified:
    - scripts/lib/generic.ts (refactored to delegate to canonical generator)
    - package.json (added generic, generic:check scripts)
    - .github/workflows/ci.yml (added drift-check step in validate job)
decisions:
  - "Skill names are unprefixed (init, contract, test, deploy, frontend) — plan's frontmatter listed `zama-init.md` etc., but the actual skill directory names are unprefixed. Followed source-of-truth (skill dir names) over plan literal."
  - "Single generator, two entry points: scripts/lib/generic.ts now delegates to scripts/generate-generic-docs.mjs so `pnpm sync` and `npm run generic:check` produce byte-identical output. Avoids two pipelines disagreeing."
  - "Appendix prose deliberately avoids the literal `${CLAUDE_SKILL_DIR}` substring (refers to it as 'the Claude skill-dir variable') so the substring can be used as a sentinel for untransformed body in tests / grep gates."
metrics:
  duration: ~25 min
  completed: 2026-05-04
  task_count: 3
  test_count: 7
---

# Phase 06 Plan 02: Generic Docs Generator Summary

Implements DIST-02 — auto-generates `generic/<name>.md` rehberler from each `plugins/zama-skills/skills/<name>/SKILL.md` so non-Claude AI agents (Cursor / Copilot / Codex) have an equivalent copy-paste-able guide, with a CI drift gate (`npm run generic:check`) that fails when committed output drifts from fresh generator output.

## What was built

- **`scripts/generate-generic-docs.mjs`** — zero-deps Node ESM generator exporting `generateGenericDoc({ skillPath, skillContent?, skillName? })` and `generateAll({ outDir? })`. Strips Claude-only frontmatter (`allowed-tools`, `disable-model-invocation`, `context: fork`), republishes them in a `## Claude-specific notes` appendix, substitutes `${CLAUDE_SKILL_DIR}` → `<plugin-skill-dir>`, stamps `source_sha` from `git hash-object`, and writes deterministic frontmatter (fixed key order, no timestamps).
- **`scripts/generate-generic-docs.test.mjs`** — 7 vitest cases: name/description echo, SHA stamping, `source:` pointer, frontmatter strip → appendix round-trip, `${CLAUDE_SKILL_DIR}` substitution, 5-skill enumeration, byte-determinism on re-run.
- **`generic/{init,contract,test,deploy,frontend}.md`** — 5 regenerated rehberler with the new richer shape (frontmatter + provenance header + body + Claude-specific appendix).
- **`scripts/lib/generic.ts`** — refactored to a thin wrapper around the new generator so the existing `pnpm sync` engine produces identical output and there is one canonical generator (no two-pipelines-drift class of bug).
- **`package.json`** — added `generic` (write) and `generic:check` (regen + `git diff --exit-code generic/`) scripts.
- **`.github/workflows/ci.yml`** — added `Generic docs drift check` step in the existing `validate` job after `Run tests`.

## TDD gates

- **RED** (`545510a`): `test(06-02): RED tests for generic docs generator` — 7 tests, all failing (module-not-found).
- **GREEN** (`7c2332d`): `feat(06-02): implement generic docs generator + materialize 5 docs` — all 7 pass; second `generateAll()` call byte-identical (Test 7).
- **CI gate** (`8e19105`): `ci(06-02): drift gate for generic docs`.

Sanity-tested the gate end-to-end: appending `<!-- tampered source -->` to `plugins/zama-skills/skills/init/SKILL.md` (without regenerating) makes `git diff --exit-code generic/` exit 1; restoring the source returns to exit 0.

## Deviations from plan

### Auto-fixed

**1. [Rule 1 — Plan/reality mismatch] Skill filenames are unprefixed**

- **Found during:** Task 2.
- **Issue:** Plan frontmatter `files_modified` lists `generic/zama-init.md`, `generic/zama-contract.md`, etc. — but the actual skill directories are `plugins/zama-skills/skills/{init,contract,test,deploy,frontend}/` (unprefixed), and the existing `generic/*.md` files use unprefixed names too. Following the plan literally would have created 5 new `generic/zama-*.md` files alongside the existing unprefixed set — leaving stale duplicates and breaking `scripts/build.ts` which writes `generic/<skillName>.md`.
- **Fix:** Use the actual skill directory names (`init`, `contract`, …). Output is `generic/init.md`, `generic/contract.md`, `generic/test.md`, `generic/deploy.md`, `generic/frontend.md`.
- **Files:** `generic/{init,contract,test,deploy,frontend}.md`.
- **Commit:** `7c2332d`.

**2. [Rule 3 — Blocking conflict] Existing generator pipeline disagreed with new one**

- **Found during:** Task 2 (right after first generation).
- **Issue:** `scripts/build.ts` (the `pnpm sync` engine) already calls `generateGenericFromSkill()` from `scripts/lib/generic.ts`, which produced minimal generic docs (frontmatter stripped + tiny header). After landing the new richer generator, `npm run sync:check` reported drift on all 5 generic files because `pnpm sync` would overwrite them with the old minimal shape.
- **Fix:** Refactored `scripts/lib/generic.ts` to delegate to `scripts/generate-generic-docs.mjs` (passing the post-marker-expansion `skillContent`). Now both `pnpm sync` and `npm run generic:check` produce byte-identical output — single source of truth.
- **Files:** `scripts/lib/generic.ts`.
- **Commit:** `7c2332d`.

**3. [Rule 1 — Test fixture issue] Appendix prose contained the sentinel substring**

- **Found during:** Task 2 first vitest run (Test 5 failed).
- **Issue:** The "Claude-specific notes" appendix originally contained the literal `${CLAUDE_SKILL_DIR}` substring inside backticks (e.g., "occurrences of `${CLAUDE_SKILL_DIR}` have been rewritten…"). The test asserts the entire output contains no `${CLAUDE_SKILL_DIR}` token (treating that substring as a sentinel for "untransformed body").
- **Fix:** Reworded the appendix to refer to "the Claude skill-dir variable" instead of embedding the literal token. The test sentinel now reliably means "body was not transformed" with zero false positives.
- **Files:** `scripts/generate-generic-docs.mjs`.
- **Commit:** `7c2332d`.

### Deferred (out of scope per scope-boundary rule)

- **`scripts/validate.test.ts` — 2 subprocess tests fail with `proc.status === null`** because they hardcode `REPO_ROOT/node_modules/.bin/tsx`, but this worktree shares `node_modules` with the parent repo (no `.bin/tsx` at the worktree root). Pre-existing failure; verified by `git stash && npm test` that it occurs on baseline. Logged in `.planning/phases/06-distribution-submission/deferred-items.md`. Suggested fix: have the test resolve `tsx` via `require.resolve("tsx/package.json")` or fall back to the parent repo's bin.

## Auth gates

None.

## Verification

- `npm run generic:check` → 0 (clean tree, idempotent).
- `npm run sync:check` → 0 (existing sync engine still clean — unified pipeline).
- `npx vitest run scripts/generate-generic-docs.test.mjs` → 7/7 pass.
- `npx tsc --noEmit` → no errors.
- Manual gate sanity: tamper `plugins/zama-skills/skills/init/SKILL.md` → `npm run generic:check` exit 1; restore → exit 0.

## Self-Check: PASSED

Verified files exist:
- `scripts/generate-generic-docs.mjs` — FOUND
- `scripts/generate-generic-docs.test.mjs` — FOUND
- `generic/init.md`, `generic/contract.md`, `generic/test.md`, `generic/deploy.md`, `generic/frontend.md` — FOUND
- `.github/workflows/ci.yml` contains `generic:check` — FOUND
- `package.json` contains `generic:check` — FOUND

Verified commits exist:
- `545510a` test(06-02) — FOUND
- `7c2332d` feat(06-02) — FOUND
- `8e19105` ci(06-02) — FOUND
