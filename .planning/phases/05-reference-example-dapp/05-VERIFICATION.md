---
phase: 05-reference-example-dapp
verified: 2026-05-03T22:00:00Z
status: human_needed
score: 3/6 must-haves fully verified; 3/6 partially met with documented user-action paths
overrides_applied: 0
human_verification:
  - test: "Open Sepolia Etherscan link for 0x04Bd105DE7a5D3297c3747cef90ac8b760136896 and confirm verified source code visible (EXAMPLE-02 sub-criterion)"
    expected: "Etherscan 'Contract' tab shows 'Source Code' with green checkmark; not just bytecode"
    why_human: "Verification requires ETHERSCAN_API_KEY which is intentionally absent in this run; documented in DEPLOYED.md as user-action follow-up. Programmatic check would need API key."
  - test: "After binding repo to Vercel per VERCEL.md, load the production URL, connect MetaMask on Sepolia, mint, watch BalanceCard cycle through idle→encrypting→relayer-pending→revealed, perform a confidential transfer (EXAMPLE-03)"
    expected: "End-to-end FHE flow round-trips: mint tx confirms, useDecrypted hook surfaces a decrypted balance, transfer succeeds and recipient sees their decrypted balance"
    why_human: "Vercel binding is a manual one-time GitHub OAuth step (per project policy: skills scaffold, humans deploy); requires real wallet, faucet ETH, and visual UX verification."
  - test: "Confirm whether Confidential Token Registry registration is required for a standalone ERC-7984 (no underlying ERC-20 wrapper) or whether the documented 'skip — Wrappers Registry expects token+wrapper pair' interpretation is correct (EXAMPLE-02 sub-criterion)"
    expected: "Either (a) confirm Wrappers Registry only accepts wrapper pairs and EXAMPLE-02 registry sub-criterion is N/A for this token shape, OR (b) identify a standalone-token registry endpoint and register the cDEMO contract"
    why_human: "Requires Zama protocol domain knowledge; cannot be resolved by code/grep alone."
deferred:
  - truth: "README first-viewport polish (hero, install snippet, demo GIF, full skills table, live URLs above-fold)"
    addressed_in: "Phase 6"
    evidence: "ROADMAP Phase 6 SC-1 explicitly covers DIST-01 README polish; demo GIF placeholder at examples/confidential-token/docs/demo.gif marked '<!-- placeholder until Phase 6 records the real GIF -->'; this phase only updated root README hero block per scope note in objective"
gaps: []
---

# Phase 5: Reference Example dApp — Verification Report

**Phase Goal:** A judge clicks the README link and within 30 seconds sees a working confidential-token dApp at a live Vercel URL with a verified Sepolia contract — proves the skills produce real production-grade output.

**Verified:** 2026-05-03T22:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | `examples/confidential-token/` exists, hand-curated from `/zama-init`+`/zama-contract`+others, contains `.gsd-snapshot.json` | ✓ VERIFIED | Directory present with full pnpm monorepo (`packages/contracts`, `packages/frontend`, `pnpm-workspace.yaml`); `.gsd-snapshot.json` records `use_case: erc7984-confidential-token`, 5 skill commit SHAs, `pinned_versions_sha`, scaffold inputs, and skill invocation order |
| 2a | Contract address in README opens on Sepolia Etherscan **with verified source code** | ⚠️ PARTIAL — on-chain ✓, verify ✗ | `eth_getCode` against `https://ethereum-sepolia.publicnode.com` returns 16,270 bytes of bytecode at `0x04Bd105DE7a5D3297c3747cef90ac8b760136896` (real deployed contract). DEPLOYED.md transparently documents `Verified: skipped — ETHERSCAN_API_KEY missing` with manual-verify command for user follow-up |
| 2b | Contract appears in Confidential Token Registry | ⚠️ PARTIAL (interpretation) | DEPLOYED.md documents `Registry: skipped — Token is standalone ERC-7984 (no underlying ERC-20). Wrappers Registry expects token+wrapper pair`; this is a documented design decision that needs human protocol-level confirmation |
| 3 | Vercel URL in README loads, allows MetaMask Sepolia connect, accepts encrypted input, submits tx, displays user-decrypted result via `useDecrypted` | ⚠️ PARTIAL — code complete, binding pending | Frontend code complete: `src/lib/fhe.ts`, `src/hooks/useDecrypted.ts`, `src/components/EncryptedInput.tsx`, `components/BalanceCard.tsx` (4-state UX), `components/MintButton.tsx`, `components/TransferForm.tsx`, `components/Connect.tsx` (RainbowKit), `.env.local.example` pre-fills contract address + relayer URL. README contains `<VERCEL_URL>` placeholder marked `<!-- @sync:vercel-url -->` with VERCEL.md providing 6-step bind walkthrough. Per project policy: skills scaffold, humans deploy |
| 4 | CI smoke-diff job compares fresh `/zama-init token` output against `examples/confidential-token/` key files and passes | ✓ VERIFIED | `.github/workflows/example-smoke-diff.yml` exists (workflow runs unit tests + smoke-diff on push/PR); `scripts/example-smoke-diff.mjs` (16.5K) implements normalized package.json diff, structural Solidity invariants, hardhat config import checks, frontend deprecated-import scans, pinned-version cross-check; 40 unit tests pass; live run output: `✓ example-smoke-diff: no drift detected — example: examples/confidential-token, allowlist patterns: 3, structural invariants: 2 file(s), pinned-version cross-checks: 10 package(s)` |

**Score:** 3/6 fully VERIFIED; 3/6 PARTIAL with documented user-action paths (no implementation gaps).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `examples/confidential-token/README.md` | Hero w/ contract link, Vercel link, badges, demo, env-var table | ✓ VERIFIED | All sections present; Vercel URL is placeholder pending bind |
| `examples/confidential-token/.gsd-snapshot.json` | Skill versions + use case + scaffold inputs | ✓ VERIFIED | All required fields present; pinned-versions SHA recorded |
| `examples/confidential-token/DEPLOYED.md` | Address, tx, block, verification, registry | ✓ VERIFIED | Complete; transparently documents verify+registry skips with user-action commands |
| `examples/confidential-token/VERCEL.md` | Step-by-step Vercel binding | ✓ VERIFIED | 6-step walkthrough including root-dir, env vars, troubleshooting table |
| `examples/confidential-token/packages/contracts/deployments/sepolia/Token.json` | Deployment artifact w/ ABI + address | ✓ VERIFIED | address, deployer, txHash, blockNumber, args, ABI all present |
| `examples/confidential-token/packages/frontend/.env.local.example` | All NEXT_PUBLIC_* keys w/ pre-fills | ✓ VERIFIED | 4 vars; contract address + relayer URL pre-filled; RPC + WC project ID blank with guidance |
| `examples/confidential-token/packages/frontend/components/{BalanceCard,MintButton,TransferForm,Connect,Hero}.tsx` | Functional UI components | ✓ VERIFIED | All 5 present; non-stub sizes (3-8KB each); BalanceCard imports relayer-sdk per grep |
| `examples/confidential-token/packages/frontend/src/{hooks/useDecrypted.ts,lib/fhe.ts,components/EncryptedInput.tsx}` | Skill-output FHE primitives | ✓ VERIFIED | All present per `grep -rl relayer-sdk\|useDecrypted\|EncryptedInput` |
| `scripts/example-smoke-diff.mjs` | EXAMPLE-05 drift checker | ✓ VERIFIED | 16.5K; runs successfully w/ no drift |
| `.github/workflows/example-smoke-diff.yml` | CI job for smoke-diff | ✓ VERIFIED | Runs on push to main + all PRs |
| `README.md` (root) — Try-it-live block | DIST-01 partial — hero updated this phase | ✓ VERIFIED | Contains "Try it live" section with Vercel placeholder, contract Etherscan link, and pointer to `examples/confidential-token/`; full DIST-01 polish (90s GIF, skills table) deferred to Phase 6 |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Frontend `BalanceCard.tsx` | `@zama-fhe/relayer-sdk` | import | ✓ WIRED | grep confirms relayer-sdk import in BalanceCard + TransferForm + lib/fhe.ts |
| Frontend `.env.local.example` | Sepolia contract | `NEXT_PUBLIC_CONTRACT_ADDRESS` pre-fill | ✓ WIRED | Pre-filled with deployed address `0x04Bd105…6896` |
| Root `README.md` | Example dApp | "Try it live" link to `examples/confidential-token/` | ✓ WIRED | Link present; contract Etherscan link present; Vercel `<VERCEL_URL>` is placeholder |
| `examples/confidential-token/README.md` | Sepolia Etherscan | Contract badge + inline link | ✓ WIRED | Badge URL points to `#code` tab on Etherscan |
| Smoke-diff script | Pinned versions | `plugins/zama-skills/shared/pinned-versions.json` | ✓ WIRED | 10 package cross-checks executed |
| CI workflow | Smoke-diff script | `node scripts/example-smoke-diff.mjs` | ✓ WIRED | YAML step calls the script; tests run before |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `BalanceCard.tsx` | encrypted balance handle | Live Sepolia contract via ethers + relayer-sdk decrypt | Yes — points to real deployed contract @ `0x04Bd105…6896` (16,270 bytes bytecode confirmed via `eth_getCode`) | ✓ FLOWING (pending live UX verification listed in human_verification) |
| `Token.json` deployment artifact | contract address | Hardhat deploy script | Yes — real on-chain deployment, tx `0x7d24fa87…` block 10784067 | ✓ FLOWING |
| Root README "Try it live" Vercel badge | URL | Manual fill post-Vercel-bind | NO yet — placeholder `<VERCEL_URL>` | ⚠️ HOLLOW (intentional — documented user-action path in VERCEL.md) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Workspace validate (manifests, sync, asset audits) | `pnpm validate` | All 4 audits pass: marketplace+plugin+5 SKILL.md valid, no drift, init asset audit pass, Phase 4 skill audit pass | ✓ PASS |
| EXAMPLE-05 smoke-diff (no drift between example + skill output) | `SMOKE_DIFF_SKIP_SCAFFOLD=1 node scripts/example-smoke-diff.mjs` | `✓ no drift detected — 3 allowlist patterns, 2 structural invariants, 10 pinned-version cross-checks` | ✓ PASS |
| Smoke-diff unit tests | `npx vitest run scripts/example-smoke-diff.test.mjs` | 40 PASS / 0 FAIL | ✓ PASS |
| Live contract has bytecode on Sepolia | `eth_getCode 0x04Bd105…6896` against `ethereum-sepolia.publicnode.com` | Returns 16,270-byte bytecode string (not `0x`) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| EXAMPLE-01 | 05-01 | Hand-curated working confidential token dApp from `/zama-*` skills | ✓ SATISFIED | Full dApp under `examples/confidential-token/`; `.gsd-snapshot.json` records skill commits |
| EXAMPLE-02 | 05-04 | Sepolia deploy + Etherscan verify + Registry register | ⚠️ PARTIAL | Deploy ✓ (live bytecode confirmed); verify ⚠️ documented user-action (no API key); registry ⚠️ documented N/A interpretation (standalone ERC-7984) |
| EXAMPLE-03 | 05-02, 05-03, 05-05 | Live Vercel URL with end-to-end FHE round-trip | ⚠️ PARTIAL | All code, env scaffolding, and bind walkthrough complete; manual Vercel binding pending (per project policy: humans deploy) |
| EXAMPLE-04 | 05-01 | `.gsd-snapshot.json` records skill provenance | ✓ SATISFIED | Present with version 1, all 5 skill SHAs, pinned-versions hash, scaffold inputs |
| EXAMPLE-05 | 05-06 | CI smoke-diff vs fresh skill output | ✓ SATISFIED | Workflow + script + tests all green; live run shows zero drift |
| DIST-01 (partial) | 05-05 | Root README hero block updated | ✓ SATISFIED (for this phase's scope) | "Try it live" block added with Vercel placeholder + Etherscan link; remaining DIST-01 polish deferred to Phase 6 per objective scope note |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `examples/confidential-token/README.md` | 6, 10 | Placeholder `<VERCEL_URL>` not yet replaced | ℹ️ Info | Intentional; marked `<!-- @sync:vercel-url -->`; resolved on Vercel bind |
| `examples/confidential-token/README.md` | 17 | demo.gif placeholder | ℹ️ Info | Deferred to Phase 6 (per ROADMAP DIST-01) |

No blockers, no stubs in implementation code, no deprecated imports detected (smoke-diff cross-checks fhevmjs / fhevm-root bans).

### Human Verification Required

See frontmatter `human_verification` for 3 items:

1. **Etherscan source verification** — DEPLOYED.md transparently documents the skip; user must run `pnpm hardhat verify --network sepolia 0x04Bd…6896 …` after providing `ETHERSCAN_API_KEY`. The skill output and on-chain deployment are correct; only verification metadata on Etherscan is missing.
2. **Vercel bind + live UX walkthrough** — VERCEL.md is a complete 6-step playbook. After bind, the four `<VERCEL_URL>` placeholders (3 in example README, 1 in root README, all marked `<!-- @sync:vercel-url -->`) should be filled.
3. **Confidential Token Registry interpretation** — confirm whether the standalone ERC-7984 path documented in DEPLOYED.md (Wrappers Registry only accepts token+wrapper pairs) is correct, or whether a standalone-token registry endpoint exists.

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|---|---|---|
| 1 | Full README polish (hero one-liner refinement, single-line install snippet, 90-second demo GIF, complete skills table, badges) | Phase 6 | ROADMAP Phase 6 SC-1: "README first viewport contains: hero one-liner, single-line install snippet, 90-second demo video (embedded `.mp4` or GIF), 5-row skills table, live Sepolia contract URL, live Vercel frontend URL"; objective scope note: "DIST-01 (partial — root README hero updated this phase, full polish in Phase 6)"; demo.gif file is explicitly placeholder |

### Gaps Summary

There are **no implementation gaps**. All code, scripts, CI, deploy artifacts, and documentation deliverables for Phase 5 exist and function correctly:

- The pnpm monorepo is real and complete; the contract is genuinely deployed to Sepolia (16,270 bytes of bytecode at the documented address); the smoke-diff CI passes with zero drift; `pnpm validate` passes all four audits; 40/40 smoke-diff unit tests pass.
- The three "partial" items are **all gated by external user actions** the project intentionally does not automate per its stated policy ("skills scaffold, humans deploy") and resource availability (no Etherscan API key in this run):
  - **EXAMPLE-02 verify:** documented manual `hardhat verify` command in DEPLOYED.md.
  - **EXAMPLE-02 registry:** documented N/A interpretation requiring human protocol confirmation.
  - **EXAMPLE-03 Vercel:** complete VERCEL.md walkthrough; the four `<VERCEL_URL>` sync markers will be filled when the user binds the repo.

Status `human_needed` (not `gaps_found`) reflects that the next move is human action, not a code fix. Recommend the orchestrator surface the 3 human-verification items to the user before declaring Phase 5 fully closed, but the artifact-level deliverables are complete and ready to proceed to Phase 6.

---

*Verified: 2026-05-03T22:00:00Z*
*Verifier: Claude (gsd-verifier)*
