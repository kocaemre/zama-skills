---
phase: 02-shared-infrastructure
plan: 04
subsystem: shared-infrastructure
tags: [skill-markers, transclusion, sync, materialization, idempotency]
requires:
  - "Plan 02-01 outputs (pinned-versions.json, deprecated-imports.json)"
  - "Plan 02-02 outputs (shared/context7-query.md, snippets/*, prompts/*)"
  - "Plan 02-03 outputs (scripts/build.ts, scripts/lib/markers.ts, scripts/lib/generic.ts)"
provides:
  - "5 SKILL.md files with sync markers materialized end-to-end"
  - "5 generic/<skill>.md auto-generated rehberler (sans-frontmatter mirror)"
  - "Demonstrable single-source-of-truth: bumping versions.json or any snippet propagates to all 5 skills via `pnpm sync`"
affects:
  - "Plan 02-05 (validate-ci): consumes idempotent state — runSync({check:true}) must remain green"
  - "Phase 3 (init/deploy skill content): markers in place; downstream plans add skill-specific body around them"
  - "Phase 4 (contract/test/frontend skill content): same"
tech-stack:
  added: []
  patterns:
    - "Marker placement strictly BELOW YAML frontmatter (preserves 1536-char description+when_to_use cap)"
    - "Per-skill marker map driven by ORCHESTRATION.md table (not free-form)"
    - "Runtime templates (closing-summary) use {{TOKEN}} placeholders, not nested @sync markers"
key-files:
  created:
    - .planning/phases/02-shared-infrastructure/02-04-SUMMARY.md
  modified:
    - plugins/zama-skills/skills/init/SKILL.md
    - plugins/zama-skills/skills/contract/SKILL.md
    - plugins/zama-skills/skills/test/SKILL.md
    - plugins/zama-skills/skills/deploy/SKILL.md
    - plugins/zama-skills/skills/frontend/SKILL.md
    - plugins/zama-skills/shared/context7-query.md
    - plugins/zama-skills/shared/prompts/closing-summary.md
    - generic/init.md
    - generic/contract.md
    - generic/test.md
    - generic/deploy.md
    - generic/frontend.md
decisions:
  - "Markers placed below frontmatter `---`, not above — frontmatter description+when_to_use auto-invoke matching depends on the 1536-char cap; markers above would have inflated frontmatter."
  - "generic/<skill>.md filename (not generic/zama-<skill>.md) — preserves Plan 02-03's already-shipped build-script contract; plan 02-04's `zama-` prefix in some verification language was inconsistent with plan 02-03 SUMMARY."
  - "Runtime template markers in closing-summary.md replaced with {{VERSIONS_TABLE}} / {{SEPOLIA_FAUCET}} placeholders — strict-no-nesting parser (scripts/lib/markers.ts) cannot tolerate `@sync:` markers inside a `@sync:`-wrapped body."
metrics:
  duration: ~6 min
  completed: 2026-05-03
  tasks: 2
  files: 12
  commits: 2
requirements: [SHARED-02, SHARED-04, SHARED-05]
---

# Phase 2 Plan 04: Skill Markers Summary

Inserted sync markers into all 5 SKILL.md skeletons, ran `tsx scripts/build.ts` to materialize transcluded content, and regenerated `generic/<skill>.md` rehberler. Build is idempotent: `--check` exits 0 after a clean write.

## Per-Skill Marker Map (binding for Phase 3/4)

Markers are inserted between the closing `---` of frontmatter and the existing `# /zama-skills:<name> — Skeleton` heading. Order is consistent across skills.

| Skill | shared:context7-query | prompt:anti-deprecation | snippet:deprecation-guard | snippet:versions-table | snippet:acl-tip | snippet:sepolia-faucet | prompt:decryption-paths | prompt:closing-summary |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| init | ✓ | ✓ | ✓ | ✓ |  | ✓ |  | ✓ |
| contract | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ |  |
| test | ✓ | ✓ | ✓ | ✓ | ✓ |  |  |  |
| deploy | ✓ | ✓ | ✓ | ✓ |  | ✓ |  | ✓ |
| frontend | ✓ | ✓ | ✓ | ✓ |  |  | ✓ |  |

Section heading inserted above each marker pair (e.g., `## Documentation Authority` for context7-query, `## Pinned Versions` for versions-table). See any SKILL.md for the canonical layout.

## Frontmatter Cap Concerns

| Skill | description chars | when_to_use chars | combined | cap | margin |
|-------|------|------|----------|-----|--------|
| init | 213 | 184 | 397 | 1536 | 1139 |
| contract | 290 | 192 | 482 | 1536 | 1054 |
| test | 196 | 178 | 374 | 1536 | 1162 |
| deploy | 200 | 134 | 334 | 1536 | 1202 |
| frontend | 251 | 153 | 404 | 1536 | 1140 |

All five skills are well below cap. Markers placed below frontmatter — no risk of leakage. Phase 3/4 may add up to ~1000 more chars to frontmatter before hitting the cap.

## Build Pipeline Verification

| Check | Result |
|-------|--------|
| Pre-write `tsx scripts/build.ts --check` | exit=1, drift on 12 files (expected) |
| Write `tsx scripts/build.ts` | Synced 9 files (5 SKILL.md + 5 generic, with retries) |
| Post-write `tsx scripts/build.ts --check` | exit=0 ✓ |
| Idempotent re-run `tsx scripts/build.ts` | Synced 0 files ✓ |
| `pnpm test` | 25/25 PASS (markers + versions test suites) |
| `pnpm typecheck` | zero errors ✓ |

## Generic Rehber Output

5 files in `generic/`: `init.md`, `contract.md`, `test.md`, `deploy.md`, `frontend.md`. Each prepends `> Auto-generated from plugins/zama-skills/skills/<name>/SKILL.md — do not edit manually. Run \`pnpm sync\` to regenerate.` and strips YAML frontmatter. Sizes 10K–12.4K each.

## Commits

- `f0ed68f` — `feat(02-04): insert sync markers into 5 SKILL.md skeletons`
- (latest) — `feat(02-04): materialize sync markers across 5 SKILL.md + regenerate generic/`

## Deviations from Plan

**1. [Rule 1 — Bug] Self-referential nested marker in `shared/context7-query.md`**
- **Found during:** Task 2 first build run
- **Issue:** Line 3 of `shared/context7-query.md` (Wave-2 output) embedded a literal `<!-- @sync:shared:context7-query --> ... <!-- @endsync -->` token inside backticks as a self-description. After build expansion into a SKILL.md, the parser saw an outer `@sync:shared:context7-query` whose body contained the literal child marker → "Nested @sync markers not allowed".
- **Fix:** Rewrote the explanatory sentence to reference `a @sync:shared:context7-query marker pair` in plain prose (no literal HTML comment tokens).
- **Files modified:** `plugins/zama-skills/shared/context7-query.md`
- **Commit:** task-2 commit (squashed with materialization)

**2. [Rule 1 — Bug] Nested @sync markers inside `prompts/closing-summary.md` runtime template**
- **Found during:** Task 2 second build run
- **Issue:** `closing-summary.md` is a *runtime* print template (skill substitutes placeholders at runtime). Wave-2 author embedded `<!-- @sync:snippet:versions-table -->...<!-- @endsync -->` and `<!-- @sync:snippet:sepolia-faucet -->...<!-- @endsync -->` inside the template's code block, intending build-time double-transclusion. But `scripts/lib/markers.ts` is strict-no-nesting (the iterative `replaceAllMarkers` re-parses but `parseMarkers` rejects any `@sync:` token in a marker body — even ones that would be expanded next pass).
- **Fix:** Replaced the inner markers with `{{VERSIONS_TABLE}}` and `{{SEPOLIA_FAUCET}}` placeholder tokens, and updated the doc to instruct the skill runtime to read those snippets directly. This is architecturally cleaner — closing-summary is per-invocation skill output, not a build artifact.
- **Files modified:** `plugins/zama-skills/shared/prompts/closing-summary.md`
- **Commit:** task-2 commit
- **Note for Plan 02-03 SUMMARY accuracy:** That SUMMARY claimed "closing-summary nesting works" but the implementation actually rejects it. Either the parser needs relaxation (Phase 6 chore) or the runtime-placeholder approach used here is the de facto contract.

**3. [Spec mismatch] Plan 02-04 verification listed `generic/zama-<skill>.md` filenames; Plan 02-03 already shipped `generic/<skill>.md`**
- **Found during:** Task 2 verification step
- **Issue:** Plan 02-04 frontmatter `files_modified` and the task-2 `<automated>` block referenced `generic/zama-init.md`, `generic/zama-contract.md`, etc. But `scripts/build.ts` (already merged in Plan 02-03 with summary documenting `generic/{init,contract,test,deploy,frontend}.md`) writes to the un-prefixed paths.
- **Fix:** Kept the existing build-script behavior (un-prefixed). The `zama-` prefix is redundant — these files already live in a Zama-skills-specific repo and the SKILL name is unambiguous.
- **Files modified:** none (kept Plan 02-03 contract)
- **Action:** Plan 02-05 (validate-ci) and Phase 3+ should reference `generic/<skill>.md`.

## Single-Source-of-Truth Smoke Test (informal)

Manually edited `pinned-versions.json` (`@fhevm/solidity` from `^0.11.1` → `^0.11.2`), ran `tsx scripts/build.ts`, observed the new version propagated into the `versions-table` block in all 5 SKILL.md files and all 5 generic/*.md files in a single pass. Reverted the edit + re-ran sync. Promise demonstrably holds.

## Gotchas / Notes for Downstream Plans

- **Plan 02-05 (validate-ci):** Wire `runSync({check:true})` into `scripts/validate.ts`. Use the exported `DRIFT_MSG` from build.ts for the error string — do not duplicate.
- **Plan 02-05 + Phase 3:** Use `pnpm sync` and `pnpm sync:check` (to be added in 02-05) — never invoke `npx tsx scripts/build.ts` (rtk shim collision; see Plan 02-03 SUMMARY note).
- **Phase 3/4 skill content authoring:** When fleshing out skill bodies BELOW the marker block, do not insert new `@sync:` markers — instead, edit the corresponding `shared/snippets/*.md` or `shared/prompts/*.md` files. Skill-local instructions go in the SKILL.md body proper (after the marker block); shared content stays single-sourced.
- **Phase 6 nice-to-have:** Consider relaxing `scripts/lib/markers.ts` parser to permit nested `@sync:` markers (since `replaceAllMarkers` already iterates correctly), which would unblock the `closing-summary` runtime template using markers natively. Currently blocked by `NESTED_OPEN_RE` rejecting any second-level marker.

## Self-Check: PASSED

- [x] All 5 SKILL.md files have required marker pairs (verified via grep)
- [x] All 5 generic/<skill>.md files exist with auto-gen header
- [x] `tsx scripts/build.ts --check` exits 0 after write (idempotent)
- [x] `pnpm test` → 25/25 PASS
- [x] `pnpm typecheck` → zero errors
- [x] Both commits exist on current branch (markers commit + materialization commit)
- [x] Frontmatter description+when_to_use under 1536-char cap on all 5 skills
