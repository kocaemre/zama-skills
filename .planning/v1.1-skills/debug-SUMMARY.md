---
phase: v1.1-skills
plan: debug
subsystem: skills
tags: [skill, debug, error-catalog, vitest]
requires: []
provides: [zama-debug-skill, fhevm-error-pattern-catalog]
affects: [plugins/zama-skills/skills/debug]
tech-stack:
  added: []
  patterns: [pattern-database, regex-matcher-engine, cli-with-stdin-fallback]
key-files:
  created:
    - plugins/zama-skills/skills/debug/SKILL.md
    - plugins/zama-skills/skills/debug/scripts/diagnose.ts
    - plugins/zama-skills/skills/debug/scripts/diagnose.test.ts
    - plugins/zama-skills/skills/debug/scripts/lib/patterns.ts
    - plugins/zama-skills/skills/debug/scripts/lib/matcher.ts
    - plugins/zama-skills/skills/debug/assets/PATTERNS.md
  modified: []
decisions:
  - "First-match-wins regex order: keep specific patterns earlier in PATTERNS"
  - "PATTERNS.md mirrors patterns.ts; CI cross-check enforces both stay in sync"
  - "CLI accepts --error / --file / stdin for flexibility from skill or shell"
metrics:
  completed: "2026-05-04"
  tasks: 6
  tests_passing: 24
---

# v1.1-skills Plan debug: /zama-debug Skill Summary

Builds the `/zama-debug` Claude Code skill: paste an FHE error message, get a structured diagnosis (cause + concrete fix steps + reference link) sourced from a curated catalog of 10 high-frequency fhEVM failure patterns.

## What was delivered

- `SKILL.md` with frontmatter (description 450 chars + when_to_use 582 chars = 1032, well under the 1536 limit) declaring the trigger phrases and `allowed-tools: AskUserQuestion Read Bash(node *) Bash(npx *) Bash(tsx *) Grep`.
- `scripts/lib/patterns.ts` — typed `DebugPattern[]` catalog with all 10 required entries:
  1. `acl-not-allowed`
  2. `relayer-sdk-bundle-import` (`/bundle` vs `/web`)
  3. `deprecated-fhevmjs`
  4. `deprecated-fhevm-root`
  5. `hcu-exceeded`
  6. `next-indexeddb-ssr` (Phase 5 SSR fix)
  7. `etherscan-v1-deprecated`
  8. `relayer-timeout`
  9. `wagmi-undefined-readcontract` (ABI sync)
  10. `zama-config-not-found`
- `scripts/lib/matcher.ts` — pure `diagnose(text, patterns)` engine + `renderDiagnosis(result)` markdown renderer; first-match-wins; treats empty / non-string input as no-match.
- `scripts/diagnose.ts` — CLI with three input modes: `--error "<text>"`, `--file <path>`, stdin pipe. Exit codes: 0 = match, 1 = no match, 2 = usage error. Also exports a pure `run({argv, stdin})` for tests.
- `scripts/diagnose.test.ts` — vitest suite with 24 tests:
  - Catalog shape (count, structure, unique names): 3 tests
  - One regex-vs-sample test per pattern: 10 tests
  - Engine edge cases (empty, unrelated, non-string, render): 5 tests
  - CLI driver (`--error`, stdin, no-match exit, missing-input exit): 4 tests
  - PATTERNS.md mirror cross-check (heading per name, declared count): 2 tests
- `assets/PATTERNS.md` — human-readable catalog mirroring `patterns.ts`. CI test asserts every `name` has a matching `### <name>` heading and that the declared "Patterns registered: **N**" header matches `PATTERN_COUNT`.

## Verification

- `npx vitest run plugins/zama-skills/skills/debug` → 24/24 passing.
- End-to-end smoke: `tsx scripts/diagnose.ts --error "revert ACL: not allowed"` returns the `acl-not-allowed` markdown block, exit 0.
- Frontmatter compliance: combined description+when_to_use length = 1032 chars (limit 1536).

## Deviations from Plan

None — plan executed exactly as written. Notes:

- Used `node ${CLAUDE_SKILL_DIR}/scripts/diagnose.ts` form in SKILL.md per the precedent set by `skills/contract/SKILL.md` (which also calls `node ${CLAUDE_SKILL_DIR}/scripts/...`). The `tsx` script is also runnable directly because of the `#!/usr/bin/env -S npx tsx` shebang.
- Did NOT touch `marketplace.json`, `plugin.json`, or any other skill directory (parallel-safe).
- No `Co-Authored-By: Claude` trailer per parallel-execution constraint.

## Self-Check: PASSED

Files exist:
- `plugins/zama-skills/skills/debug/SKILL.md` ✓
- `plugins/zama-skills/skills/debug/scripts/diagnose.ts` ✓
- `plugins/zama-skills/skills/debug/scripts/diagnose.test.ts` ✓
- `plugins/zama-skills/skills/debug/scripts/lib/patterns.ts` ✓
- `plugins/zama-skills/skills/debug/scripts/lib/matcher.ts` ✓
- `plugins/zama-skills/skills/debug/assets/PATTERNS.md` ✓
- `.planning/v1.1-skills/debug-SUMMARY.md` ✓ (this file)

Tests: 24/24 vitest passing.
