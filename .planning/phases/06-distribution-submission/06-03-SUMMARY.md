---
phase: 06
plan: 06-03
subsystem: distribution
tags: [licenses, attribution, compliance, dist]
requires: []
provides: [THIRD_PARTY_LICENSES.md]
affects: [README links section]
tech-stack:
  added: []
  patterns: [license-attribution]
key-files:
  created:
    - THIRD_PARTY_LICENSES.md
  modified: []
decisions:
  - "Treat BSD-3-Clause-Clear as distinct SPDX from BSD-3-Clause; include full text + explicit patent-clause callout."
  - "Reproduce MIT text once at end (per MIT terms) rather than per-package — dozens of MIT deps would be unreadable otherwise."
  - "Document shadcn/ui as source-distributed MIT (not an npm dep) since it's vendored via the shadcn CLI."
  - "Flag two non-obvious cases: typescript is Apache-2.0 (not MIT), and encrypted-types is MIT (not BSD-3-Clause-Clear despite being Zama-published)."
metrics:
  duration: ~5 min
  completed: 2026-05-04
  tasks: 1
  files: 1
requirements: [DIST-03]
---

# Phase 06 Plan 03: Third-Party Licenses Summary

Audited every dependency across the root `package.json` and both scaffolded packages (`examples/confidential-token/packages/{contracts,frontend}/package.json`) and produced a single `THIRD_PARTY_LICENSES.md` at repo root with structured per-license tables, full BSD-3-Clause-Clear text (with patent-clause callout), and a single MIT reproduction.

## What was built

`/THIRD_PARTY_LICENSES.md` (231 lines) organized into six sections:

1. **Zama Protocol (fhEVM) — BSD-3-Clause-Clear** — `@fhevm/solidity`, `@fhevm/hardhat-plugin`, `@fhevm/mock-utils`, `@fhevm/host-contracts`, `@zama-fhe/relayer-sdk`. Full Clear-BSD text inline with explicit "no patent grant" callout.
2. **OpenZeppelin Confidential & Standard Contracts — MIT** — `@openzeppelin/confidential-contracts`, `@openzeppelin/contracts`.
3. **Frontend Stack — MIT** — `next`, `react`, `react-dom`, `ethers`, `viem`, `wagmi`, `@rainbow-me/rainbowkit`, `@tanstack/react-query`, `tailwindcss`, plus all Radix / Tailwind utilities / lucide / sonner / etc. shadcn/ui documented as source-distributed.
4. **Hardhat & Build Tooling — MIT** — entire Nomic Foundation stack + linters + typechain.
5. **Root CLI Tooling — MIT (+ Apache-2.0 for typescript)** — commander, fs-extra, picocolors, prompts, vitest, zod, tsx; typescript flagged as Apache-2.0.
6. **Full MIT License Text** — reproduced once.

Plus a "How this file is maintained" footer enumerating the four package.json paths to scan and the verification commands (`npm view <pkg> license`, `npm view <pkg> repository.url`).

## Verification

- `test -f THIRD_PARTY_LICENSES.md` ✓
- `grep -q 'BSD-3-Clause-Clear'` ✓
- `grep -q '@fhevm/solidity'` ✓
- `grep -q '@openzeppelin/confidential-contracts'` ✓
- `grep -q '@zama-fhe/relayer-sdk'` ✓
- `wc -l = 231` (≥60 required) ✓
- All 17 license lookups via `npm view <pkg> license` confirmed against expected SPDX values

## Deviations from Plan

**None auto-fixed for Rules 1-3.**

Minor scope expansions over the plan's example skeleton (all in spirit of the plan's "every dep in any package.json appears in the table" verification gate):

- Added `@fhevm/host-contracts@0.10.0` (transitive but listed in contracts/package.json) to the Zama section.
- Listed full set of Radix / Tailwind utility / icon / toast deps in the frontend table rather than collapsing to "etc."
- Added section 5 (Root CLI Tooling) — the plan skeleton mentioned it under "Build / CLI Tooling" but did not separate root deps from contracts devDeps.
- Documented `typescript` as Apache-2.0 explicitly (plan didn't call it out; it's a real exception).
- Added "Particular attention required" caveats for the three license edge cases (`@fhevm/*` BSD-3-Clause-Clear vs BSD-3-Clause, `encrypted-types` MIT despite Zama, `typescript` Apache-2.0).

## Notes for downstream work

- Plan 06-01 (README) is responsible for adding a `THIRD_PARTY_LICENSES.md` link in the Links section. This plan only creates the file; cross-link is owned by 06-01.
- If a future plan adds new deps anywhere under `plugins/zama-skills/skills/*/assets/`, this file must be re-audited (footer documents the procedure).

## Self-Check: PASSED

- File exists: `THIRD_PARTY_LICENSES.md` ✓
- Commit `11dcca5` present in `git log --oneline` ✓

## Commits

- `11dcca5` — `docs(06-03): add THIRD_PARTY_LICENSES.md`
