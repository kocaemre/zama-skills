---
phase: v1.1-skills
plan: design
subsystem: zama-skills/skills/design
tags: [skill, claude-code, design, blueprint, fhevm, oz-confidential]
requires: [shared/context7-query, shared/pinned-versions.json]
provides: [/zama-design slash command, DESIGN.md.tpl, UI-WIREFRAME.md.tpl, generateDesign() CLI]
affects: [plugins/zama-skills/skills/design/**]
tech-stack:
  added: [vitest (existing), @types/node (existing)]
  patterns: [TDD RED→GREEN, applySubs() (mirrors closing-summary renderer), per-category recommendation lookup table, post-render deprecation guard]
key-files:
  created:
    - plugins/zama-skills/skills/design/SKILL.md
    - plugins/zama-skills/skills/design/scripts/generate.ts
    - plugins/zama-skills/skills/design/scripts/generate.test.ts
    - plugins/zama-skills/skills/design/scripts/lib/templates.ts
    - plugins/zama-skills/skills/design/assets/templates/DESIGN.md.tpl
    - plugins/zama-skills/skills/design/assets/templates/UI-WIREFRAME.md.tpl
  modified: []
decisions:
  - "Per-category recommendations live in a static lookup table inside templates.ts (FALLBACK shape). Live context7 queries (per SKILL.md Documentation Authority block) refine these at skill runtime — the skill never relies solely on stale snapshots."
  - "Post-render deprecation guard matches only actual import/from/require statements, not prose mentions. Templates legitimately discuss WHY fhevmjs/fhevm are deprecated; the guard would otherwise produce false positives."
  - "Output lands at .planning/v1-design/<slug>/ (NOT .planning/v1.1-skills/) because the design output is a USER artifact (consumed by the next skill in their project), not a developer artifact about this plugin."
  - "Combined description+when_to_use is 1214 chars (well under the 1536 cap) — leaves headroom for future Turkish/English keyword additions."
metrics:
  completed: 2026-05-04
  tests: 28
  loc_added: ~1420
---

# v1.1-skills design Summary

One-liner: `/zama-design` skill — turns a free-form confidential dApp idea into two grounded blueprint files (DESIGN.md + UI-WIREFRAME.md) under `.planning/v1-design/<slug>/`, with per-category OZ-base recommendations, ACL strategy per actor, decryption path per data slot, and the project-standard 4-state UX hook (idle / encrypting / pending / decrypted) wired into every component.

## What was built

### SKILL.md (frontmatter + workflow)

- `name: design`, exploratory skill (no `disable-model-invocation` — Claude can auto-invoke from trigger phrases like "design my fhevm app", "anlat fikrini", "blueprint zama dapp", "wireframe zama").
- `allowed-tools` whitelist limited to `mkdir`/`ls`/`cat` + `AskUserQuestion`/`Read`/`Write`/`Edit` — the skill writes design markdown, never runtime code.
- Transcludes the canonical `@sync:shared:context7-query` block so every doc lookup follows the same invocation order as `/zama-init` and `/zama-contract`.
- 6-step workflow: elicit (3 single-select questions + free-form one-liner + slug) → ground in context7 → run generator → closing summary referencing `/zama-init` as the next skill.
- Documents the planned future `/zama-init --from-design <path>` flag and the manual handoff that bridges until that flag lands.

### `scripts/lib/templates.ts` (pure renderers, ~430 LOC)

- `validateInputs()` — kebab-case slug guard + enum validation for category / confidential / decryption.
- `recommendBase(category)` — per-category lookup of the OZ confidential primitive (or "custom") with rationale, Solidity import block, inheritance line, and the matching `/zama-init` use-case answer.
- `schemaFor(category, confidential)` — per-category default encrypted state schema (e.g. auction → `bids: euint64`, `winner: eaddress`, `highestBid: euint64`).
- `aclTableFor(category)` — per-category ACL grant table; always includes the `FHE.allowThis(handle)` rule for the contract itself.
- `decryptionTableFor(inputs, schema)` — fans out per-slot decryption path with the corresponding `@zama-fhe/relayer-sdk` call (`userDecrypt`, `publicDecrypt`, or callback event listener); handles the `mixed` strategy by routing tally/winner/highestBid → public, outcome → oracle, everything else → user.
- `flowsFor()`, `componentTreeFor()`, `userFlowsFor()`, `screenStatesFor()`, `outOfScopeFor()`, `openQuestionsFor()` — per-category strings that surface the 4-state UX hook in every flow + screen.
- `applySubs()` — `{{KEY}}` substitution that LEAVES UNKNOWN PLACEHOLDERS IN PLACE so authors notice missing data (mirrors the convention in `_lib/closing-summary.ts`).

### `scripts/generate.ts` (orchestrator, ~150 LOC)

- Pipeline: validate → render substitutions → read templates → apply subs → deprecation guard → refuse overwrite without `--force` → write two files.
- Post-render `checkDeprecatedImports()` matches only `from "fhevmjs"`, `import "fhevmjs"`, `require("fhevmjs")` (and the same triplet for root-pkg `fhevm`). Prose mentions explaining the deprecation are allowed because the templates legitimately reference them.
- CLI shape: `node ${CLAUDE_SKILL_DIR}/scripts/generate.ts --inputs '<JSON>' [--force]` returning a JSON manifest on stdout (matches `/zama-init` scaffold helper convention).
- `generateDesign({ now })` accepts an injectable clock for deterministic tests.

### Templates

- `assets/templates/DESIGN.md.tpl` — 9-section blueprint: contract architecture, encrypted state schema, ACL strategy per actor, decryption path per data type, key flows, network/deployment notes, pinned stack table, recommended next skills, open questions for the developer.
- `assets/templates/UI-WIREFRAME.md.tpl` — 7-section wireframe: component tree, user flows, the 4-state UX hook reference (with the `ConfidentialAction<T>` TypeScript signature every component should adopt), screen states per primary view, accessibility/UX guardrails, out-of-scope, recommended next skills.

### Tests (`scripts/generate.test.ts`, 28 assertions)

- `validateInputs` — accepts valid slug, refuses path-traversal (`../evil`), uppercase, unknown enums, trivial one-liner.
- `renderDesignSubs` — verifies ERC7984 for `confidential-token`, VotesConfidential for `voting`, custom-only for `auction`, schema rows include `bids`/`winner`/`eaddress` for auction, ACL table contains both `FHE.allowThis` and `FHE.allow(`, decryption table reflects the chosen strategy (`userDecrypt` / `publicDecrypt`), `mixed` fans out per-slot, and no rendered field embeds deprecated package names.
- `renderWireframeSubs` — component tree is category-specific, user flows mention all four UX states, screen states always document the connect screen.
- `applySubs` — substitutes when present, leaves unknown placeholders visible.
- `generateDesign` end-to-end — writes both files at `.planning/v1-design/<slug>/`, contains rendered base recommendation + ACL table, no leftover `{{...}}` placeholders for known keys, contains the 4-state UX hook + relayer-sdk reference, refuses overwrite without `--force`, overwrites with `--force`, refuses path-traversal slug, post-grep on a tampered file gets clean output on regeneration.

## Verification

- `pnpm exec vitest run plugins/zama-skills/skills/design/` → **28 pass / 0 fail**.
- SKILL.md frontmatter combined `description` + `when_to_use` = 1214 chars (cap 1536).
- No `Co-Authored-By: Claude` trailer in either commit (per orchestrator instruction).
- No edits to `marketplace.json`, `STATE.md`, `ROADMAP.md`, or any other skill directory.

## TDD Gate Compliance

- RED gate: commit `test(v1.1-design): add failing vitest suite for /zama-design generator` (vitest reported "Failed to load url ./generate.ts").
- GREEN gate: commit `feat(v1.1-design): implement /zama-design generator (GREEN)` — 28/28 pass.
- REFACTOR: not needed — generator is straightforward orchestration; future passes can DRY the per-category lookups if more variants appear.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Deprecation guard regex too broad**
- **Found during:** First test run after writing `generate.ts`.
- **Issue:** Initial regex `\bfhevmjs\b` matched legitimate prose mentions in `DESIGN.md.tpl` ("The `fhevmjs` package is deprecated as of 2025-07-10 — never import it") and `UI-WIREFRAME.md.tpl`, causing 5/28 tests to fail.
- **Fix:** Tightened to match only actual `from`/`import`/`require` statements quoting the package name. Updated 2 tests in `generate.test.ts` to mirror the same scope (prose allowed, imports forbidden).
- **Files modified:** `plugins/zama-skills/skills/design/scripts/generate.ts`, `plugins/zama-skills/skills/design/scripts/generate.test.ts`.
- **Commit:** combined into the GREEN commit (single iteration; would have artificially split the cycle to commit separately).

### Deferred Items

The repo-wide `pnpm exec vitest run` shows 4 pre-existing tests now failing because of the new skill count:

- `scripts/generate-generic-docs.test.mjs` — hard-codes "5 skills" → needs to become 8 once the parallel `audit` and `debug` agents merge their skill dirs too.
- `scripts/validate.test.ts` — drift detection assertion off-by-one for the same reason.

These are out-of-scope per the orchestrator boundary contract ("Do NOT modify STATE.md, ROADMAP.md, or marketplace.json" and "DO NOT touch other skill dirs"). Three parallel executor agents are each adding a skill in this wave; fixing the count to "6" here would conflict with the audit/debug agents. Logged in `.planning/v1.1-skills/deferred-items-design.md` for the orchestrator to reconcile post-merge (likely via `pnpm generic` regeneration + a one-line bump in both test files).

## Recommended Next Skills

1. Orchestrator: after wave merge, run `pnpm generic` to regenerate `generic/*.md` (will pick up `design.md`, `audit.md`, `debug.md`), then update the `toHaveLength(5)` and hard-coded name list in `scripts/generate-generic-docs.test.mjs` and the corresponding fixture in `scripts/validate.test.ts`.
2. Future: implement `/zama-init --from-design <path>` flag so the design → init handoff is one-step instead of manual.

## Self-Check: PASSED

- `[ -f plugins/zama-skills/skills/design/SKILL.md ]` → FOUND
- `[ -f plugins/zama-skills/skills/design/scripts/generate.ts ]` → FOUND
- `[ -f plugins/zama-skills/skills/design/scripts/generate.test.ts ]` → FOUND
- `[ -f plugins/zama-skills/skills/design/scripts/lib/templates.ts ]` → FOUND
- `[ -f plugins/zama-skills/skills/design/assets/templates/DESIGN.md.tpl ]` → FOUND
- `[ -f plugins/zama-skills/skills/design/assets/templates/UI-WIREFRAME.md.tpl ]` → FOUND
- RED commit (test) present in git log
- GREEN commit (feat) present in git log
- 28/28 vitest assertions green
