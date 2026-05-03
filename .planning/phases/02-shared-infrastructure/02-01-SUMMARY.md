---
phase: 02-shared-infrastructure
plan: 01
subsystem: shared-infrastructure
tags: [versions, deprecation, zod, schema, helper]
requires:
  - zod ^3.25.0
  - vitest ^2.1.9
  - tsx ^4.21.0
provides:
  - "Single source of truth: pinned-versions.json"
  - "Deprecation banlist: deprecated-imports.json"
  - "Typed accessor module: scripts/lib/versions.ts"
affects:
  - "Future build.ts (02-03), validate.ts (02-05), skill content (Phase 3+) consume getVersion()/isDeprecated()"
tech-stack:
  added: []
  patterns:
    - "zod runtime schema validation for JSON config"
    - "Module-level cache + _resetCache for testability"
key-files:
  created:
    - plugins/zama-skills/shared/pinned-versions.json
    - plugins/zama-skills/shared/deprecated-imports.json
    - scripts/lib/versions.ts
    - scripts/lib/versions.test.ts
  modified: []
decisions:
  - "Filename: pinned-versions.json (NOT versions.json from CONTEXT.md) — REQUIREMENTS SHARED-01 is binding per ORCHESTRATION.md"
  - "deprecated-imports.json authored as separate file (not embedded in pinned-versions.json) per SHARED-03"
  - "Helper module ESM, runs via tsx; no build step"
metrics:
  duration: ~5 minutes
  completed: 2026-05-03
  tasks: 2
  files: 4
  commits: 3
requirements: [SHARED-01, SHARED-03]
---

# Phase 2 Plan 01: Pinned Versions & Deprecation Registry Summary

Established the single-source-of-truth registry for fhEVM/OpenZeppelin package versions plus a deprecation banlist, with a typed zod-validated TypeScript helper that downstream sync/build/validate scripts will consume.

## Artifacts

| File | Purpose |
|------|---------|
| `plugins/zama-skills/shared/pinned-versions.json` | All 31 pinned packages + compiler/node/typescript versions per CLAUDE.md |
| `plugins/zama-skills/shared/deprecated-imports.json` | `fhevmjs`, `fhevm` deprecations + `hardhat@^3`, `ethers@^5` incompatibilities |
| `scripts/lib/versions.ts` | Exports `getVersion`, `isDeprecated`, `loadVersions`, `loadDeprecated`, `getCompilerVersion`, `listAllPackages`, `VersionsSchema`, `DeprecatedSchema`, `_resetCache` |
| `scripts/lib/versions.test.ts` | 12 vitest cases covering happy path, exact-version, missing-pkg error, deprecation lookup, schema rejection |

## Schema Choices

- **`pinned-versions.json`**: `packages` is `Record<string, { version, exact?, aliasOf?, notes? }>`; `compiler.solc`, `node`, `typescript` are top-level scalars. `exact: true` denotes "no caret" (e.g. `@fhevm/mock-utils@0.4.2`).
- **`deprecated-imports.json`**: Two top-level dicts — `deprecated` (banned packages with `replaces`) and `incompatible` (version-range bans with `useInstead`). Distinguishes "package is dead" from "version range is wrong".
- **zod**: Validation happens at load time; both schemas use `z.record(...)` for open-ended package keys.

## Verification Results

| Check | Status |
|-------|--------|
| `node -e "JSON.parse(...)"` parses both files | PASS — outputs `OK` |
| `npx vitest run scripts/lib/versions.test.ts` | PASS — 12/12 |
| `npx tsc --noEmit` | PASS — zero errors |
| `grep -c '"@fhevm/solidity"' pinned-versions.json` | 1 |
| `grep -c '"fhevmjs"' deprecated-imports.json` | 1 |

## Commits

- `9c332b1` — `feat(02-01): author pinned-versions.json and deprecated-imports.json`
- `1ef92b5` — `test(02-01): add failing tests for versions.ts helper module` (RED)
- `72c6cf4` — `feat(02-01): implement versions.ts helper with zod schema validation` (GREEN)

## Deviations from Plan

**1. [Filename Resolution] `pinned-versions.json` chosen over CONTEXT.md's `versions.json`**
- Per ORCHESTRATION.md row 1, REQUIREMENTS SHARED-01 names `pinned-versions.json` verbatim and is the binding spec. CONTEXT.md was a discussion artifact. Plan already encoded this resolution; recorded for traceability.

**2. [Strict TS] Test file required optional-chaining for `noUncheckedIndexedAccess`**
- Plan-supplied test sketch indexed `v.packages.foo.version` directly; `tsconfig.json` has `noUncheckedIndexedAccess: true`, so changed to `v.packages.foo?.version` and `d.deprecated.fhevmjs?.replaces` etc. Behavioral coverage unchanged.

No other deviations. Both auto-fixes are scoped to the current task (Rule 3, blocking-issue resolution).

## Gotchas / Notes for Downstream Plans

- `_resetCache()` MUST be called between tests when state-spanning fixtures load alternate JSON files (see `loadVersions schema validation` block in test).
- `SHARED_DIR` resolves from `process.cwd()`. CI/local runs invoking from project root work; if invoked from a sub-directory, callers should pass an explicit path.
- `@zama-fhe/relayer-sdk-dev` is an alias entry (`aliasOf: "@zama-fhe/relayer-sdk"`) holding the exact `0.4.1` peer that `@fhevm/hardhat-plugin@0.4.2` requires in devDependencies. Build script (02-03) should consume it for hardhat-template generation.
- Sepolia contract addresses are intentionally NOT in this file — fetched live by skills at runtime per CLAUDE.md.

## Self-Check: PASSED

- [x] `plugins/zama-skills/shared/pinned-versions.json` exists
- [x] `plugins/zama-skills/shared/deprecated-imports.json` exists
- [x] `scripts/lib/versions.ts` exists
- [x] `scripts/lib/versions.test.ts` exists
- [x] All 3 task commits exist on current branch
- [x] All success criteria met; verification block 1-5 all PASS
