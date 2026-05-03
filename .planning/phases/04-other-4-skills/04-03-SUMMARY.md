---
phase: 04-other-4-skills
plan: 03
subsystem: zama-deploy-skill
tags: [skill, deploy, sepolia, fhevm, registry, abi-export]
requires:
  - 04-01-SUMMARY (zama-contract skill — emits ERC7984 contracts that trigger Step 5)
  - 04-02-SUMMARY (zama-test skill — provides compiled artifacts for ABI export)
  - 03-* (init skill scaffolds workspace, .env.example, .gitignore)
provides:
  - /zama-deploy slash command (disable-model-invocation: true) — Sepolia deploy + Etherscan verify + Confidential Token Registry registration + ABI export
  - lib/env-validate.ts — strict .env check (REQUIRED + either-of group); used by /zama-deploy and reusable by other deploy-adjacent skills
  - lib/sepolia-addresses.ts — pure parser + 24h-cached fetcher for live Zama Sepolia addresses; reusable by /zama-frontend (relayer URL discovery)
  - lib/abi-export.ts — Hardhat artifact → frontend abis/ JSON; reusable by /zama-frontend
  - lib/preflight.ts — chainId hard-check + deprecation guard; reusable by other on-chain skills
affects:
  - .cache/zama-addresses.json (runtime, gitignored)
  - packages/frontend/src/abis/<Name>.json (runtime, written per deploy)
tech-stack:
  added: []
  patterns:
    - DI fetcher for testability (no live network in unit tests)
    - Regex stdout capture (`Deployed at: 0x...`) for orchestrator <-> deploy script handshake
    - Env-var passthrough (ZAMA_TOKEN_REGISTRY/ZAMA_TOKEN_ADDRESS) for templates that must NEVER pin Sepolia addresses
key-files:
  created:
    - plugins/zama-skills/skills/deploy/scripts/deploy.ts
    - plugins/zama-skills/skills/deploy/scripts/deploy.test.ts
    - plugins/zama-skills/skills/deploy/scripts/lib/env-validate.ts
    - plugins/zama-skills/skills/deploy/scripts/lib/sepolia-addresses.ts
    - plugins/zama-skills/skills/deploy/scripts/lib/abi-export.ts
    - plugins/zama-skills/skills/deploy/scripts/lib/preflight.ts
    - plugins/zama-skills/skills/deploy/assets/templates/deploy.ts.tpl
    - plugins/zama-skills/skills/deploy/assets/templates/register-token.ts.tpl
  modified:
    - plugins/zama-skills/skills/deploy/SKILL.md (Phase 1 skeleton → 8-step body)
decisions:
  - Sepolia chainId 11155111 hard-checked in BOTH preflight.ts (config-level via regex) AND deploy.ts (runtime via ethers.provider.getNetwork) AND deploy.ts.tpl (script-level) — three-layer defense against mainnet-by-mistake
  - Registry address NEVER pinned in source — passed to register-token.ts via env vars (ZAMA_TOKEN_REGISTRY/ZAMA_TOKEN_ADDRESS), populated by orchestrator from getSepoliaAddresses cache
  - Etherscan verify failure is non-fatal (single retry on rate-limit, then skip-with-warning) — deploy succeeds even if verification API is down
  - Either-of env group (`MNEMONIC|PRIVATE_KEY`) surfaces as a single missing entry rather than two — matches user mental model
  - DI fetcher pattern (instead of mocking node:https) keeps the unit suite hermetic and fast
metrics:
  duration: ~25 minutes (parallel worktree, autonomous)
  completed: 2026-05-03
  tasks: 3
  files: 8
  tests: 23 (all green)
---

# Phase 4 Plan 03: /zama-deploy Skill Summary

Authored the `/zama-deploy` skill: a 7-step Sepolia-only deploy flow with strict env validation, live Zama address fetching (no pinning), Etherscan verify, optional Confidential Token Registry registration, and ABI export to the frontend. The skill is `disable-model-invocation: true` — Claude must never auto-invoke it.

## Substantive one-liner

`/zama-deploy` takes a freshly-compiled fhEVM contract from a `/zama-init`'d workspace through compile → Sepolia deploy → Etherscan verify → (conditional) ERC7984 registry registration → ABI export, with three-layer mainnet-abort and zero pinned Sepolia hex addresses.

## Requirements satisfied

- **DEPLOY-01** Etherscan verify with single rate-limit retry, non-fatal skip-on-failure
- **DEPLOY-02** Confidential Token Registry registration triggered when `is ERC7984` detected in source
- **DEPLOY-03** Live `WebFetch` of `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` cached to `.cache/zama-addresses.json` with 24h TTL; cold/warm/stale paths verified
- **DEPLOY-04** Strict `.env` validation: `SEPOLIA_RPC_URL` + `ETHERSCAN_API_KEY` + (`MNEMONIC|PRIVATE_KEY`); fails with named-missing list before any compile or tx
- **DEPLOY-05** `disable-model-invocation: true` plus Step 0 confirmation prompt with deployer/RPC/network preview

## Env vars enforced (validateEnv)

| Var | Status | Failure surface |
|-----|--------|------|
| `SEPOLIA_RPC_URL` | required | named in missing list |
| `ETHERSCAN_API_KEY` | required | named in missing list |
| `MNEMONIC` or `PRIVATE_KEY` | either-of | listed as `MNEMONIC\|PRIVATE_KEY` |

## Address registry parser

The pure `parseAddressesFromHtml` extracts the 6 documented labels (`ACL`, `KMSVerifier`, `InputVerifier`, `FHEVMExecutor`, `DecryptionOracle`, `ConfidentialTokenRegistry`) by anchoring on each label string and capturing the next `0x[a-fA-F0-9]{40}` within a 1024-char window. Verified on a representative fixture: all 6 labels resolved correctly.

Cache shape (gitignored, 24h TTL):
```json
{
  "fetchedAt": "2026-05-03T12:00:00.000Z",
  "ttlHours": 24,
  "addresses": {
    "ACL": "0x...",
    "KMSVerifier": "0x...",
    "InputVerifier": "0x...",
    "FHEVMExecutor": "0x...",
    "DecryptionOracle": "0x...",
    "ConfidentialTokenRegistry": "0x..."
  }
}
```

## Sample orchestration trace (test fixture, no real Sepolia smoke)

For the `Counter` non-ERC7984 happy path the test stubs `exec` and observes the following call sequence:

1. `pnpm hardhat compile`
2. `pnpm hardhat run --network sepolia scripts/deploy/Counter.ts` → returns `Deployed at: 0xabc0000000000000000000000000000000000001\n`
3. `pnpm hardhat verify --network sepolia 0xabc...` → success
4. (Step 5 skipped — no `is ERC7984` in source)
5. `exportAbi('Counter', '0xabc...')` → writes `packages/frontend/src/abis/Counter.json`
6. Closing summary contains `sepolia.etherscan.io/address/`, `VITE_COUNTER_ADDRESS`, `/zama-frontend`

For the `Token is ERC7984` variant the trace additionally invokes `register-token.ts` with `ZAMA_TOKEN_REGISTRY` and `ZAMA_TOKEN_ADDRESS` env-vars set from the cached registry; `Registered tx: 0x9999...` is captured into `r.registryTxHash`.

For the mainnet (chainId=1) variant the orchestrator returns `ok:false` with `preflightFailures` containing `ABORT: not Sepolia` — `exec` is never called.

## ABI export path

`packages/frontend/src/abis/<Name>.json` shape:
```json
{ "abi": [...], "bytecode": "0x...", "address": "0x...", "network": "sepolia" }
```

Frontend env reminder line printed in the closing summary: `VITE_<NAME_UPPER>_ADDRESS=<address>` (e.g., `VITE_COUNTER_ADDRESS=0xabc...`).

## Vitest summary

```
Test Files  1 passed (1)
     Tests  23 passed (23)
  Coverage  validateEnv (6), parseAddressesFromHtml (2), getSepoliaAddresses cache (4),
            exportAbi (2), runPreflight (5), runDeploy orchestrator (4)
```

`tsc --noEmit`: clean.

## Threat-model mitigations applied

| ID | Mitigation |
|----|------------|
| T-04-12 (auto-deploy elevation) | `disable-model-invocation: true` + Step 0 AskUserQuestion confirmation card |
| T-04-13 (mainnet by mistake) | chainId 11155111 enforced in 3 layers: preflight regex, runDeploy preflight call, deploy.ts.tpl runtime check |
| T-04-15 (stale Sepolia addresses) | `isStale` checks `Date.now() - fetchedAt >= ttl`; refetch verified by `stale cache → refetches` test |
| T-04-16 (tampered registry address) | Source = HTTPS docs.zama.org; parser anchored to documented labels; cache file is human-reviewable JSON |
| T-04-17 (Etherscan rate limit) | Single retry on `429|rate.?limit|Max calls per sec`, then skip-with-warning — does not abort deploy |
| T-04-18 (silent dep upgrades) | Skill never runs `pnpm add`; SKILL.md hard refusal documented |

## Deviations from Plan

**1. [Rule 1 — Fix] Either-of env group surfaced as single entry**
- Plan said `missing: ['MNEMONIC|PRIVATE_KEY']`. Implementation matches verbatim — verified by test `missing both MNEMONIC and PRIVATE_KEY → missing list contains 'MNEMONIC|PRIVATE_KEY'`.

**2. [Rule 2 — Critical functionality] Three-layer chainId check**
- Plan called for chainId check in preflight and deploy.ts. Added a third layer in `deploy.ts.tpl` (the materialized user-facing deploy script) so users running the script directly outside `/zama-deploy` still get the mainnet-abort safety net. Surfaces as `ABORT: not Sepolia. Detected <name> (chainId <id>)`.

**3. [Rule 3 — Blocking] `tsc` not on PATH via `pnpm typecheck`**
- `pnpm typecheck` failed with `sh: tsc: command not found` (zsh PATH inheritance quirk in worktree). Worked around by invoking `npx tsc --noEmit` directly — clean. No source change required; documented here for the next run.

No architectural deviations. No checkpoints triggered. No auth gates encountered.

## Known stubs

None. All declared interfaces are wired. The CLI shims for `env-validate.ts`, `sepolia-addresses.ts`, `abi-export.ts`, `preflight.ts`, and `deploy.ts` are functional (not placeholder).

## Manual smoke test (deferred)

Per plan, the live-Sepolia smoke (deploy a real `Counter`, verify on Etherscan, register a real ERC7984 token) requires user-driven faucet ETH and is out of scope for the autonomous executor. The unit suite covers the orchestration logic; the templates are syntactically valid TypeScript that compiles inside a `/zama-init`'d workspace.

## Self-Check: PASSED

- plugins/zama-skills/skills/deploy/SKILL.md — FOUND
- plugins/zama-skills/skills/deploy/scripts/deploy.ts — FOUND
- plugins/zama-skills/skills/deploy/scripts/deploy.test.ts — FOUND
- plugins/zama-skills/skills/deploy/scripts/lib/env-validate.ts — FOUND
- plugins/zama-skills/skills/deploy/scripts/lib/sepolia-addresses.ts — FOUND
- plugins/zama-skills/skills/deploy/scripts/lib/abi-export.ts — FOUND
- plugins/zama-skills/skills/deploy/scripts/lib/preflight.ts — FOUND
- plugins/zama-skills/skills/deploy/assets/templates/deploy.ts.tpl — FOUND
- plugins/zama-skills/skills/deploy/assets/templates/register-token.ts.tpl — FOUND
- All 3 task commits present in `git log --oneline`
