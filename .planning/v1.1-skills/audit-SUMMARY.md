---
phase: v1.1-skills
plan: audit
subsystem: plugins/zama-skills/skills/audit
tags: [skill, audit, fhevm, static-analysis, acl, hcu, deprecation]
requires: [plugins/zama-skills, shared/deprecated-imports.json]
provides: [/zama-audit slash command, AUDIT-REPORT.md generator, FHE-aware checkers]
affects: [plugins/zama-skills/skills/audit]
tech-stack:
  added: [vitest fixtures for FHE-audit]
  patterns: [regex-based static analysis, comment-aware lookahead/lookback, severity classification]
key-files:
  created:
    - plugins/zama-skills/skills/audit/SKILL.md
    - plugins/zama-skills/skills/audit/scripts/audit.ts
    - plugins/zama-skills/skills/audit/scripts/audit.test.ts
    - plugins/zama-skills/skills/audit/scripts/lib/acl-checker.ts
    - plugins/zama-skills/skills/audit/scripts/lib/cleartext-checker.ts
    - plugins/zama-skills/skills/audit/scripts/lib/hcu-counter.ts
    - plugins/zama-skills/skills/audit/scripts/lib/deprecation-grep.ts
    - plugins/zama-skills/skills/audit/scripts/lib/report.ts
    - plugins/zama-skills/skills/audit/scripts/__fixtures__/acl-bug.sol
    - plugins/zama-skills/skills/audit/scripts/__fixtures__/cleartext-bug.sol
    - plugins/zama-skills/skills/audit/scripts/__fixtures__/hcu-explosion.sol
    - plugins/zama-skills/skills/audit/scripts/__fixtures__/deprecated.sol
    - plugins/zama-skills/skills/audit/scripts/__fixtures__/deprecated.ts
    - plugins/zama-skills/skills/audit/scripts/__fixtures__/clean.sol
  modified: []
decisions:
  - Regex-based static analysis (no Solidity parser) to keep zero install deps and millisecond perf
  - HCU thresholds: warn>12, error>20 (heuristic; SKILL.md links to live HCU table)
  - Comment-aware lookahead in acl-checker so commented-out FHE.allowThis cannot suppress findings
  - Exit codes 0/1/2 for clean/warning/critical to integrate with CI
metrics:
  duration: ~25 min
  completed: 2026-05-04
---

# v1.1-skills audit Summary

`/zama-audit` skill: FHE-aware code review that detects 4 confidential-contract footgun classes and emits a Markdown audit report.

## What was built

A new Claude Code skill at `plugins/zama-skills/skills/audit/` exposing the `/zama-audit [path]` slash command. The skill orchestrates four single-purpose checkers against `*.sol` and `*.ts/.tsx/.js/.jsx/.mjs/.cjs` files, then renders a severity-classified Markdown report (`AUDIT-REPORT.md`) at the audit root.

### Checkers

| Checker | File | What it catches | Severity |
| --- | --- | --- | --- |
| ACL | `lib/acl-checker.ts` | Encrypted state-write without `FHE.allowThis(handle)` within 5 lines; encrypted return without `FHE.allow(value, msg.sender)` within 10 lines back | CRITICAL |
| Cleartext | `lib/cleartext-checker.ts` | `require()` whose condition references a decrypted var (or has leaky `%d`/`balance` message); `emit Event(decryptedVar)`; decrypt-then-emit pattern within 8 lines | CRITICAL / WARNING |
| HCU | `lib/hcu-counter.ts` | Per-function count of `FHE.{add,sub,mul,lt,gt,le,ge,eq,ne,select,cmux,and,or,xor,not}` — >12 WARN, >20 CRITICAL | WARNING / CRITICAL |
| Deprecated | `lib/deprecation-grep.ts` | Solidity `import "fhevm/..."` (root); TS `from "fhevmjs"` / `require("fhevmjs")`; TS bare `from "fhevm"` | CRITICAL |

### Report renderer

`lib/report.ts` produces a Markdown report with:
- Header (root path, scanned-file count, ISO timestamps)
- Totals table (CRITICAL / WARNING / INFO / TOTAL)
- Per-file summary table with per-severity counts
- Per-finding sections grouped by severity, each with `file:line`, rule id, category, message, code snippet, suggested fix

### CLI

`scripts/audit.ts` walks the target dir (skipping `node_modules`, `dist`, `build`, `out`, `artifacts`, `cache`, `coverage`, `typechain-types`, `__fixtures__`, `.next`, `.turbo`, `.git`), aggregates findings, writes the report, and exits:

| Exit | Meaning |
| --- | --- |
| 0 | No findings |
| 1 | At least one WARNING |
| 2 | At least one CRITICAL |

This makes the skill usable in CI as a hard gate.

## Tests

`scripts/audit.test.ts` — 22 vitest cases:
- 4 cases for ACL checker (positive: storage-write missed grant, return missed grant; negative: clean.sol; comment-suppression edge case; ignores .ts files)
- 4 cases for cleartext checker (positive: leaky require message, decrypted emit, decrypt-then-emit; negative: clean.sol)
- 4 cases for HCU counter (positive: >20 → CRITICAL on `bigPipeline`, >12 → WARNING on `mediumPipeline`; negative: tiny function, clean.sol)
- 5 cases for deprecation grep (positive: fhevm in .sol, fhevmjs in .ts; negative: @fhevm/solidity, @zama-fhe/relayer-sdk, clean.sol)
- 2 cases for report renderer (empty result, mixed severities)
- 2 cases for end-to-end orchestrator (aggregates 4 categories on fixtures, returns no findings on clean fixture)

All 22 pass via `npx vitest run scripts/audit.test.ts` from the skill dir. (Repo-root vitest excludes `.claude/worktrees/**`, so the worktree tests run from inside the skill dir or via direct vitest invocation.)

End-to-end CLI smoke (`tsx audit.ts /tmp/audit-smoke` with all 6 fixtures): scans 6 files, emits 12 findings (9 CRITICAL + 3 WARNING) covering ACL × 5, CLEARTEXT × 3, HCU × 2, DEPRECATED × 2. Exit code 2 as expected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment-suppression false negative in acl-checker**
- **Found during:** end-to-end smoke test
- **Issue:** The lookahead window for `FHE.allowThis` matched commented-out grants (`// FHE.allowThis(...)`) and suppressed valid findings. acl-bug.sol fixture has `// missing: FHE.allowThis(balance[user]);` immediately below the buggy line, which silenced the storage-write finding.
- **Fix:** Filter comment-only lines (`^\s*(?://|\*|/\*)`) out of both lookahead (acl-allowThis) and lookback (acl-allow-return) windows. Added a regression test (`does not let commented-out FHE.allowThis suppress findings`).
- **Files modified:** `plugins/zama-skills/skills/audit/scripts/lib/acl-checker.ts`, `plugins/zama-skills/skills/audit/scripts/audit.test.ts`
- **Commit:** included in the single audit-skill commit (worktree isolation; not yet split)

No other deviations. Plan executed as written: 4 checkers + report renderer + orchestrator + tests + fixtures, all under the prescribed paths.

## Heuristics & limitations (documented in SKILL.md)

- Regex, not AST. False positives possible on multi-line returns, string-template `require`, or unusual indentation; designed for idiomatic fhEVM contracts.
- HCU thresholds (`12`, `20`) are heuristics — SKILL.md points operators at the live HCU table at <https://docs.zama.org/protocol/solidity-guides/development-guide/hcu> for authoritative per-op cost.
- Not a substitute for `slither` / `solhint` / manual review — complements them with FHE-specific footguns conventional tools don't know about.

## Self-Check: PASSED

Files created (all confirmed via `git diff --name-only HEAD~1 HEAD`):
- FOUND: plugins/zama-skills/skills/audit/SKILL.md
- FOUND: plugins/zama-skills/skills/audit/scripts/audit.ts
- FOUND: plugins/zama-skills/skills/audit/scripts/audit.test.ts
- FOUND: plugins/zama-skills/skills/audit/scripts/lib/{acl-checker,cleartext-checker,hcu-counter,deprecation-grep,report}.ts
- FOUND: plugins/zama-skills/skills/audit/scripts/__fixtures__/{acl-bug,cleartext-bug,hcu-explosion,deprecated,clean}.sol
- FOUND: plugins/zama-skills/skills/audit/scripts/__fixtures__/deprecated.ts

Commit verified: feat(v1.1-skills/audit) on branch worktree-agent-a67b3aafa0fc50935.
Vitest: 22/22 pass. CLI smoke: 12 findings across 4 categories, exit 2.
