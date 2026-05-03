---
phase: 05-reference-example-dapp
plan: 04
subsystem: confidential-token-example
tags: [deploy, sepolia, etherscan, registry, hardhat]
requires:
  - examples/confidential-token/packages/contracts/contracts/Token.sol
  - examples/confidential-token/packages/contracts/hardhat.config.ts
  - .env.deploy.local (gitignored, repo root)
provides:
  - examples/confidential-token/packages/contracts/scripts/deploy.ts
  - examples/confidential-token/packages/contracts/scripts/register-with-registry.ts
  - examples/confidential-token/packages/contracts/scripts/sync-frontend-abi.ts
  - examples/confidential-token/packages/contracts/scripts/lib/zama-addresses.ts
  - examples/confidential-token/packages/contracts/deployments/sepolia/Token.json
  - examples/confidential-token/packages/contracts/addresses-cache/zama-addresses.sepolia.json
  - examples/confidential-token/packages/frontend/lib/abi/Token.json
  - examples/confidential-token/packages/frontend/.env.local.example (populated NEXT_PUBLIC_CONTRACT_ADDRESS)
  - examples/confidential-token/DEPLOYED.md
affects:
  - examples/confidential-token/README.md (Live deployment header)
tech-stack:
  added:
    - hardhat-deploy (already in devDependencies)
    - dotenv multi-path .env.deploy.local resolver (walk-up search)
  patterns:
    - "Live address fetch from docs.zama.org with 24h disk cache (CLAUDE.md `never pin Sepolia addresses`)"
    - "Idempotent deploy guard: existing deployments/sepolia/Token.json short-circuits redeploy unless FORCE_REDEPLOY=1"
    - "Best-effort registry registration with graceful skip (Wrappers Registry is owner-only)"
    - "Verify gracefully skips when ETHERSCAN_API_KEY missing"
key-files:
  created:
    - examples/confidential-token/packages/contracts/scripts/deploy.ts
    - examples/confidential-token/packages/contracts/scripts/register-with-registry.ts
    - examples/confidential-token/packages/contracts/scripts/sync-frontend-abi.ts
    - examples/confidential-token/packages/contracts/scripts/lib/zama-addresses.ts
    - examples/confidential-token/packages/contracts/deployments/sepolia/Token.json
    - examples/confidential-token/packages/contracts/addresses-cache/zama-addresses.sepolia.json
    - examples/confidential-token/packages/frontend/lib/abi/Token.json
    - examples/confidential-token/DEPLOYED.md
  modified:
    - examples/confidential-token/packages/contracts/hardhat.config.ts
    - examples/confidential-token/packages/frontend/.env.local.example
    - examples/confidential-token/.env.example
    - examples/confidential-token/README.md
  deleted:
    - examples/confidential-token/packages/contracts/scripts/register-token.ts (replaced)
decisions:
  - "Replaced stub register-token.ts (Phase-3 scaffold) with register-with-registry.ts that wires the Wrappers Registry call. Kept the standalone helper so users can re-register without redeploying."
  - "Wrappers Registry is owner-only and expects an ERC-20+wrapper *pair*; our Token is a standalone ERC-7984 — graceful skip with explanatory message."
  - "Verify gracefully skipped because no ETHERSCAN_API_KEY was provided. Manual command embedded in DEPLOYED.md."
  - "Cached zama-addresses.sepolia.json committed to repo (under addresses-cache/, NOT under hardhat's cache/) so CI smoke-diff is reproducible without hitting docs.zama.org."
  - "hardhat.config.ts walks parent dirs to find .env.deploy.local — handles worktrees (file lives at bounty-zama/ root, not at example root)."
metrics:
  duration: ~12 min
  completed: 2026-05-03
  tasks_completed: 2
  files_created: 8
  files_modified: 4
---

# Phase 05 Plan 04: Deploy Token to Sepolia Summary

**One-liner:** Wired hardhat-deploy → live Sepolia deploy of `Token` ERC-7984 at `0x1ceD5d54B8565Db5493b64Bca389b8132841B658`, with idempotent re-runs, live Zama-addresses fetch (24h cached), best-effort registry registration, and frontend env+ABI sync.

## Deployment Facts (the truths)

| Field | Value |
| --- | --- |
| Contract | `Token` (ERC-7984 + ZamaEthereumConfig) |
| Network | Sepolia (chainId 11155111) |
| Address | [`0x1ceD5d54B8565Db5493b64Bca389b8132841B658`](https://sepolia.etherscan.io/address/0x1ceD5d54B8565Db5493b64Bca389b8132841B658#code) |
| Deploy tx | [`0xe6f5c5dd0a919980e45f01c2156d56218ce8be7d0a1e74787bcf9b53f9a2fffb`](https://sepolia.etherscan.io/tx/0xe6f5c5dd0a919980e45f01c2156d56218ce8be7d0a1e74787bcf9b53f9a2fffb) |
| Block | 10784041 |
| Gas used | 1,934,915 |
| Constructor args | `name="Confidential Demo Token"`, `symbol="cDEMO"`, `uri="https://github.com/zama-ai/zama-skills"` |
| Deployer | [`0xFa2961718AE286Fb31A9AeA908F7bDF3bB8237e7`](https://sepolia.etherscan.io/address/0xFa2961718AE286Fb31A9AeA908F7bDF3bB8237e7) |
| Balance before | 0.300000 ETH |
| Balance after | 0.299998 ETH (Δ ≈ 0.0000019 ETH at deploy gasPrice) |

> Note on cost: Sepolia gas was effectively free at deploy time — the ~0.0000019 ETH delta reflects the ultra-low base fee on the public RPC at block 10784041.

## Tasks Executed

| # | Task | Commit |
| - | --- | --- |
| 1 | Authored deploy.ts + register-with-registry.ts + sync-frontend-abi.ts + lib/zama-addresses.ts; rewrote hardhat.config.ts (walk-up `.env.deploy.local`, etherscan apiKey, namedAccounts); updated `.env.example`; deleted obsolete `scripts/register-token.ts` | `a3ce6fe` |
| 2 | Real Sepolia deploy + ABI sync + frontend env + DEPLOYED.md + README live-deployment header | `9d39d55` |

## Verification Status

- **Etherscan source verification:** SKIPPED — `ETHERSCAN_API_KEY` is not present in `.env.deploy.local`. The deploy script logged this at runtime and continued (per plan: "If Etherscan API key is unavailable, skip verify and continue. Don't block the deploy.").
  - Manual command (embedded in `DEPLOYED.md`):
    ```bash
    ETHERSCAN_API_KEY=<key> pnpm hardhat verify --network sepolia \
      0x1ceD5d54B8565Db5493b64Bca389b8132841B658 \
      "Confidential Demo Token" "cDEMO" "https://github.com/zama-ai/zama-skills"
    ```

## Registry Status

- **Confidential Token Registry:** SKIPPED — Zama's Sepolia "Wrappers Registry" (`0x2f0750Bbb0A246059d80e94c454586a7F27a128e`, fetched live from <https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia.md>) is *owner-only* (per Zama docs: "All administrative actions are restricted to the registry owner") and expects an `ERC-20 ↔ ERC-7984-wrapper` pair. Our `Token` is a *standalone* ERC-7984 with no underlying ERC-20 — there is no pair to register.
- The deploy script logs a clear, descriptive skip message and the workflow continues. The script is also wired to *attempt* the call when both prerequisites are met (deploy wallet is registry owner AND a `--underlying <erc20>` arg is supplied) — see `scripts/register-with-registry.ts`.
- **Source signature confirmation:** signature `registerConfidentialToken(address erc20TokenAddress, address confidentialWrapperAddress)` confirmed against <https://docs.zama.org/protocol/protocol-apps/confidential-tokens/wrapper-registry.md> (line 188-193 of fetched markdown).

## Idempotency Confirmation

Re-running `pnpm hardhat run --network sepolia scripts/deploy.ts` against the now-populated `deployments/sepolia/Token.json` was tested live — output:
```
[idempotent] Token already deployed at 0x1ceD5d54B8565Db5493b64Bca389b8132841B658 (block 10784041).
[idempotent] Set FORCE_REDEPLOY=1 to redeploy. Re-syncing ABI + frontend env now.
```
No on-chain transaction issued; balance unchanged at 0.29999806506178102 ETH. Frontend ABI + env still re-synced (so the guard is safe for repeat invocations after frontend changes).

## Sepolia Infra Snapshot (cached at deploy time)

Fetched live from `docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia.md` and persisted to `addresses-cache/zama-addresses.sepolia.json`:

| Component | Address |
| --- | --- |
| Wrappers Registry | `0x2f0750Bbb0A246059d80e94c454586a7F27a128e` |
| Zama Token | `0xa798B04149e7a61cc95B7D114AD420e8969eA268` |
| Zama OFT Adapter | `0x55D5258841e9Fd304007683ff4637b0a80fb0e62` |
| Protocol DAO | `0x08e8a84c3c8c7cba165B1adcf67Ae4639eF84f52` |
| Pauser Set | `0xc62392B4100a1bD45AbDBf91E70f1E4349402b46` |
| ProtocolFeesBurner | `0xFda98943FB461310A5d26769606D302Ea89890e3` |

Per CLAUDE.md: these addresses are **not** pinned in any `*.ts` source file; the cache is a snapshot only, refreshed automatically every 24h.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `.env.deploy.local` resolution path**
- **Found during:** Task 2 (first deploy attempt)
- **Issue:** The plan's interfaces section referenced `examples/confidential-token/.env.deploy.local`, but the actual key file lives at the **bounty-zama repo root** (`/Users/0xemrek/Desktop/bounty-zama/.env.deploy.local`). When run from a worktree (`.claude/worktrees/agent-xxx/.../packages/contracts/`), the file is 7 directory levels up — none of the original 4 candidate paths matched.
- **Fix:** Replaced fixed-depth candidate list with a walk-up search (10 levels max) plus an explicit `DEPLOY_ENV_FILE` env var override. Both worktree and main-checkout layouts now resolve the file.
- **Files modified:** `examples/confidential-token/packages/contracts/hardhat.config.ts`
- **Commit:** `9d39d55`

**2. [Rule 2 - Critical] Plan referenced `Token.deploy(name, symbol, decimals=6)` but constructor signature is `(name, symbol, uri)`**
- **Found during:** Task 1 (reading Token.sol)
- **Issue:** Plan interface §2 specifies `constructor (name="Confidential Demo Token", symbol="cDEMO", decimals=6)`. The actual `Token.sol` extends OZ `ERC7984(name, symbol, uri)` — there is no `decimals` constructor arg (ERC7984 fixes decimals at 6 internally; URI replaces it).
- **Fix:** Used the real signature: `("Confidential Demo Token", "cDEMO", "https://github.com/zama-ai/zama-skills")`.
- **Files modified:** `examples/confidential-token/packages/contracts/scripts/deploy.ts`
- **Commit:** `a3ce6fe`

### Authentication Gates

- **Etherscan API key:** No `ETHERSCAN_API_KEY` was present. Deploy proceeded with `verify` gracefully skipped, exactly as the task brief instructed ("If Etherscan API key is unavailable: skip verify and continue. Don't block the deploy.").

### Out-of-scope (logged to deferred-items)

- Pre-existing TypeScript errors in `test/Token.sepolia.test.ts` and `test/Token.test.ts` (5 errors total) — unrelated to this plan, do not block deploy. Tracked separately if not already in `deferred-items.md`.

## Plan Tasks vs Actual

| Plan Task | Status |
| --- | --- |
| Task 1 — Author scripts + hardhat.config wiring | DONE (`a3ce6fe`) |
| Task 2 — Run deploy + verify + register on Sepolia | DONE (`9d39d55`) — verify+registry skipped per plan-permitted graceful paths |
| Task 3 — Human-verify checkpoint | DEFERRED — this executor runs in parallel/auto mode; verification belongs to the orchestrator/user. Plan expectations: open Etherscan link in `DEPLOYED.md` (currently "unverified" until ETHERSCAN_API_KEY is supplied + manual `pnpm hardhat verify` is run); confirm Token bytecode matches; (optional) round-trip mint via local frontend with the populated `NEXT_PUBLIC_CONTRACT_ADDRESS`. |

## Success Criteria Audit

- [x] Token.sol deployed to Sepolia (real tx hash + address) — `0xe6f5c5d…2fffb` → `0x1ceD…1B658`
- [x] `deployments/sepolia/Token.json` contains address + ABI + tx hash + block
- [x] Token registry call attempted with graceful skip + reason logged
- [x] Etherscan verify attempted with graceful skip + manual command persisted
- [x] `frontend/.env.local.example` updated with `NEXT_PUBLIC_CONTRACT_ADDRESS=0x1ceD…1B658`
- [x] `README.md` updated with Etherscan URL (Live deployment header)
- [x] `.env.deploy.local` NEVER committed (verified via `git log --all -p | grep DEPLOYER_PRIVATE_KEY=0x` → empty)
- [x] SUMMARY.md committed
- [x] No modifications to STATE.md or ROADMAP.md (parallel-mode constraint)

## Self-Check: PASSED

- `examples/confidential-token/packages/contracts/scripts/deploy.ts` — FOUND
- `examples/confidential-token/packages/contracts/scripts/register-with-registry.ts` — FOUND
- `examples/confidential-token/packages/contracts/scripts/sync-frontend-abi.ts` — FOUND
- `examples/confidential-token/packages/contracts/scripts/lib/zama-addresses.ts` — FOUND
- `examples/confidential-token/packages/contracts/deployments/sepolia/Token.json` — FOUND (address `0x1ceD5d54B8565Db5493b64Bca389b8132841B658`)
- `examples/confidential-token/packages/contracts/addresses-cache/zama-addresses.sepolia.json` — FOUND
- `examples/confidential-token/packages/frontend/lib/abi/Token.json` — FOUND (36 ABI entries)
- `examples/confidential-token/DEPLOYED.md` — FOUND
- Commit `a3ce6fe` — FOUND in git log
- Commit `9d39d55` — FOUND in git log
- `.env.deploy.local` content scan in git history — CLEAN
