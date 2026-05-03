---
phase: 04-other-4-skills
plan: 02
subsystem: skills/test
tags: [skill, test, fhevm, hardhat, acl, hcu]
requires:
  - plugins/zama-skills/shared/snippets/acl-tip.md
  - plugins/zama-skills/shared/pinned-versions.json
provides:
  - /zama-test slash command (mock + sepolia test scaffolds)
  - generateTests() runtime
  - runTestPreflight() (workspace + ethers v6 guard)
affects:
  - packages/contracts/test/<Name>.test.ts (output target in user projects)
  - packages/contracts/test/<Name>.sepolia.test.ts (output target)
tech-stack:
  added: []
  patterns:
    - ACL re-decrypt assertion (decrypt-after-call) for FHE.allowThis verification
    - HCU header comment on every Sepolia integration template
    - Post-write forbidden-pattern grep (BigNumber.from / fhevmjs / ethers.utils / ethers.providers)
    - PascalCase contract-name guard blocking path traversal
key-files:
  created:
    - plugins/zama-skills/skills/test/scripts/generate.ts
    - plugins/zama-skills/skills/test/scripts/lib/preflight.ts
    - plugins/zama-skills/skills/test/scripts/generate.test.ts
    - plugins/zama-skills/skills/test/scripts/__fixtures__/Counter.sol
    - plugins/zama-skills/skills/test/assets/templates/mock.test.ts.tpl
    - plugins/zama-skills/skills/test/assets/templates/sepolia.test.ts.tpl
  modified:
    - plugins/zama-skills/skills/test/SKILL.md
decisions:
  - Hard-code output dir to packages/contracts/test/ — refuse all other targets (T-04-11)
  - Post-grep generated text for ethers v5 / fhevmjs patterns BEFORE writing (defense-in-depth on top of preflight)
  - Detect state-write fn via regex on `external<Euint*>` parameter type, fall back to TODO_writeFn placeholder if none found (no hard failure on exotic contracts)
  - Use lower-case euint type name to align with @fhevm/mock-utils FhevmType enum
metrics:
  duration: ~25min
  tasks: 2
  files: 7
  completed: 2026-05-03
---

# Phase 4 Plan 2: zama-test Skill Summary

One-liner: `/zama-test` generates two compile-clean test files (mock + Sepolia integration) per fhEVM contract, both with explicit ACL re-decrypt verification and HCU revert-risk warning.

## Tasks

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | Author SKILL.md body | `3a09465` | Done |
| 2 | Implement generate.ts + 2 templates + preflight (TDD) | `2833164` (RED), `ef2ae31` (GREEN) | Done |

## Files

**Created (6):**
- `plugins/zama-skills/skills/test/scripts/generate.ts` — runtime: detects state-write fn signature, substitutes templates, post-grep refusal of v5 patterns
- `plugins/zama-skills/skills/test/scripts/lib/preflight.ts` — workspace detect + ethers v6 guard + missing-contract refusal
- `plugins/zama-skills/skills/test/scripts/generate.test.ts` — 13 vitest cases covering all behaviors
- `plugins/zama-skills/skills/test/scripts/__fixtures__/Counter.sol` — `externalEuint64` fixture for unit tests
- `plugins/zama-skills/skills/test/assets/templates/mock.test.ts.tpl` — `createEncryptedInput` + `userDecryptEuint` + ACL re-decrypt block
- `plugins/zama-skills/skills/test/assets/templates/sepolia.test.ts.tpl` — HCU header + `network.name` guard + `createInstance(SepoliaConfig)` + relayer `userDecrypt`

**Modified (1):**
- `plugins/zama-skills/skills/test/SKILL.md` — replaced Phase 1 skeleton with full workflow (preflight → AskUserQuestion → generate → closing summary), HCU callout, hard rules

## Sample Generated Output

For a contract `Counter.sol` with `setCounter(externalEuint64, bytes)`:

```
packages/contracts/test/Counter.test.ts
packages/contracts/test/Counter.sepolia.test.ts
```

The mock test calls `fhevm.createEncryptedInput(...)`, executes `setCounter`, then re-decrypts via `fhevm.userDecryptEuint(FhevmType.euint64, ...)` to prove the ACL grants in the contract persisted. The Sepolia test does the same flow but routes through `@zama-fhe/relayer-sdk`'s `instance.userDecrypt(...)` with EIP-712 signed authorization.

## Verification

- `npx vitest run plugins/zama-skills/skills/test/scripts/generate.test.ts` — **13/13 passed**
- `npx tsc --noEmit` — **clean** (no errors)
- SKILL.md content check (`AskUserQuestion`, `HCU`, `sepolia`, `/zama-deploy`) — all present
- Post-grep on generated templates — zero v5/fhevmjs patterns

## Requirements Satisfied

- **TEST-01**: Mock test uses `@fhevm/hardhat-plugin` encrypted-input mock + decrypt assertion
- **TEST-02**: Sepolia integration scaffold gated by `network.name`
- **TEST-03**: ACL re-decrypt assertion present in BOTH templates (catches missing `FHE.allowThis` / `FHE.allow`)
- **TEST-04**: HCU revert-risk header comment at top of Sepolia template + SKILL.md callout

## Threat Model Coverage

| Threat | Disposition | Mitigation Implemented |
|--------|-------------|------------------------|
| T-04-08 (ethers v5 emit) | mitigate | preflight refusal + post-write `BigNumber.from`/`ethers.utils.*`/`ethers.providers.*` grep |
| T-04-09 (decrypt logged) | accept | by design (test-time decrypts) |
| T-04-10 (mock-only false confidence) | mitigate | HCU header in sepolia template + SKILL.md callout |
| T-04-11 (write outside test/) | mitigate | hard-coded `packages/contracts/test/` + PascalCase guard |

## Deviations from Plan

None — plan executed as written. Tests added inline with implementation following the TDD gate (RED commit `2833164` before GREEN commit `ef2ae31`).

## Known Stubs

None.

## Self-Check: PASSED

- `plugins/zama-skills/skills/test/scripts/generate.ts` — exists
- `plugins/zama-skills/skills/test/scripts/lib/preflight.ts` — exists
- `plugins/zama-skills/skills/test/assets/templates/mock.test.ts.tpl` — exists
- `plugins/zama-skills/skills/test/assets/templates/sepolia.test.ts.tpl` — exists
- `plugins/zama-skills/skills/test/scripts/generate.test.ts` — exists, 13/13 pass
- Commits `3a09465`, `2833164`, `ef2ae31` — present in `git log`
