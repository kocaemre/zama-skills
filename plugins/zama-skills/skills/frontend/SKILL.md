---
name: frontend
description: Integrate @zama-fhe/relayer-sdk into a React frontend with Wagmi/Viem or ethers v6 — encrypted input components, useDecrypted hook with relayer UX states, typechain wiring. Use when the user wants to build or extend the dApp UI.
when_to_use: Trigger phrases include "fhevm frontend", "relayer sdk", "useDecrypted", "encrypted input ui", "react fhe". Run when editing files under src/ or app/ in a fhevm project.
allowed-tools: Read Write Edit Glob Grep Bash(npm *) Bash(npx *) WebFetch
---

## Documentation Authority

<!-- @sync:shared:context7-query -->
# Context7 Query Block (canonical)

> **Single source of truth.** Every SKILL.md in this plugin transcludes this block via a `@sync:shared:context7-query` marker pair. Edit here, run `pnpm sync`, and all skills update.

## Why this exists

Zama Protocol package surfaces (`@fhevm/solidity`, `@zama-fhe/relayer-sdk`, `@fhevm/hardhat-plugin`, `@openzeppelin/confidential-contracts`) evolve faster than any LLM training cut-off. To avoid hallucinated APIs, **always query context7 for live documentation before emitting Zama-related code**.

## Required invocation order

When this skill activates, BEFORE generating any Solidity, TypeScript, or config file that touches fhEVM, perform the following calls in order:

1. **Resolve the primary fhEVM library**
   - Tool: `mcp__context7__resolve-library-id`
   - Argument: `libraryName: "fhevm"` → expect `/zama-ai/fhevm` (HIGH reputation, ~1772 snippets).

2. **Fetch topic-scoped fhEVM docs** for the operation in progress
   - Tool: `mcp__context7__get-library-docs`
   - `context7CompatibleLibraryId: "/zama-ai/fhevm"`
   - `topic:` narrowed to the user's question (e.g., `"acl"`, `"decryption"`, `"euint"`, `"relayer"`, `"auction"`).

3. **Fetch hardhat-template scaffolding docs** when generating build/test infra
   - `context7CompatibleLibraryId: "/zama-ai/fhevm-hardhat-template"`
   - `topic:` such as `"deploy"`, `"test"`, `"mock"`.

4. **Fetch OpenZeppelin Confidential Contracts** when generating tokens, governance, or vesting
   - `context7CompatibleLibraryId: "/websites/openzeppelin_confidential-contracts"`
   - `topic:` such as `"ERC7984"`, `"VotesConfidential"`, `"FHESafeMath"`.

5. **Fallback narrowing** — if returned docs are too broad, re-call `get-library-docs` with a tighter `topic:` parameter focused on the user's exact question.

## Hard rules

- **Never emit code that imports `fhevmjs` or `fhevm` (root package).** Both were officially deprecated 2025-07-10. Replacements are `@zama-fhe/relayer-sdk` and `@fhevm/solidity` respectively.
- **If returned context7 docs conflict with this plugin's `pinned-versions.json`, the JSON wins.** That file was npm-registry-verified on 2026-05-03 and reflects peer-dep alignment across the Zama stack. Treat docs as API guidance; treat the JSON as version truth.
- **Sepolia contract addresses are NEVER pinned in skill source.** Fetch live from `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` at skill runtime.

## Sources cited (HIGH reputation)

| Library ID | Snippets | Use For |
|------------|----------|---------|
| `/zama-ai/fhevm` | 1772 | Solidity FHE primitives, ACL, decryption, encrypted types |
| `/zama-ai/fhevm-hardhat-template` | 43 | Hardhat config, deploy scripts, mock testing |
| `/websites/openzeppelin_confidential-contracts` | 354 | ERC-7984, governance, FHESafeMath |
<!-- @endsync -->

## Deprecation Guardrails

<!-- @sync:prompt:anti-deprecation -->
# Anti-Deprecation Prompt

You are operating inside a Zama Protocol skill. Before emitting any package import, dependency declaration, or install command, you MUST consult the deprecation/incompatibility ban list.

## Required check

Before emitting ANY import statement, `package.json` dependency entry, or `npm install` / `pnpm add` command:

1. Read `plugins/zama-skills/shared/deprecated-imports.json`.
2. If the package name appears under the `deprecated` key:
   - **Refuse to emit the import.**
   - Emit the value at `replaces` instead.
   - Add a one-line comment explaining why (e.g., `// fhevmjs deprecated 2025-07-10; using @zama-fhe/relayer-sdk`).
3. If the package name appears under the `incompatible` key:
   - **Refuse to emit the import or install.**
   - Emit the value at `useInstead` instead.
   - Add a one-line comment explaining why (e.g., `// hardhat v3 incompatible with @fhevm/hardhat-plugin peer range`).

## Refusal contract

- **Never** offer a fallback workaround for deprecated packages. They are unsafe — no upstream support, frozen API, broken against current Sepolia infrastructure.
- **Never** suppress the deprecation warning or pin to a "last known good" version.
- If the user explicitly insists on a deprecated package, explain the failure modes (broken decryption, wrong KMS keys, no relayer compatibility) and stop.

## Cross-reference

- Canonical version pins: `plugins/zama-skills/shared/pinned-versions.json`
- Human-readable deprecation table: `plugins/zama-skills/shared/snippets/deprecation-guard.md`
<!-- @endsync -->

<!-- @sync:snippet:deprecation-guard -->
# Deprecation Guard

Two Zama packages were officially deprecated **2025-07-10**. Two adjacent packages are **incompatible** with the current fhEVM plugin and must not be installed.

## Deprecated — refuse to import

| Package | Status | Replacement |
|---------|--------|-------------|
| `fhevmjs` | Deprecated 2025-07-10. Official npm message: *"use @zama-fhe/relayer-sdk instead"* | `@zama-fhe/relayer-sdk` |
| `fhevm` (root pkg) | Deprecated 2025-07-10. Official npm message: *"use @fhevm/solidity instead"* | `@fhevm/solidity` |

## Incompatible — refuse to install

| Package | Reason | Use Instead |
|---------|--------|-------------|
| `hardhat@^3.x` | fhevm-plugin peer-dep is `hardhat@^2.0.0`; v3 untested + breaking config changes. | `hardhat@^2.28.4` |
| `ethers@^5` | fhevm-plugin pins ethers v6; v5 mismatches typechain output. | `ethers@^6.16.0` |

## Refusal contract

> **If the user asks me to import `fhevmjs` or `fhevm` (root pkg), I refuse and propose the modern replacement instead.** No fallback workaround is offered for deprecated packages — they are unsafe (no upstream support, frozen API, will fail against current Sepolia relayer/KMS contracts).

The same refusal applies to `hardhat@^3.x` and `ethers@^5` until the fhEVM plugin upgrades its peer dependency range.
<!-- @endsync -->

## Pinned Versions

<!-- @sync:snippet:versions-table -->
<!-- Generated from pinned-versions.json — do not edit manually; run `pnpm sync` to regenerate. -->

# Pinned Zama Stack Versions

The following versions are the authoritative pin set for this plugin. They were verified via direct `npm view` queries against the npm registry on **2026-05-03** and cross-checked against the `fhevm-hardhat-template` `package.json` for peer-dep alignment.

| Package | Version | Notes |
|---------|---------|-------|
| `@fhevm/solidity` | `^0.11.1` | Solidity FHE library. Replaces deprecated `fhevm` (root pkg). OZ confidential pins this exactly. |
| `@fhevm/hardhat-plugin` | `^0.4.2` | Mock encrypt/decrypt + local FHE node for tests. |
| `@fhevm/mock-utils` | `0.4.2` | Exact-version peer of hardhat-plugin. |
| `@fhevm/host-contracts` | `0.10.0` | Pulled in transitively by hardhat-plugin. |
| `@zama-fhe/relayer-sdk` | `^0.4.2` | Frontend SDK. Replaces deprecated `fhevmjs`. Use exact `0.4.1` in devDeps to match plugin peer; `^0.4.2` in frontend deps. |
| `@openzeppelin/confidential-contracts` | `^0.4.0` | ERC-7984, VotesConfidential, FHESafeMath. |
| `@openzeppelin/contracts` | `^5.6.1` | Required peer of confidential-contracts. |
| `@openzeppelin/contracts-upgradeable` | `^5.6.1` | Optional, paired with above. |
| `encrypted-types` | `^0.0.4` | Shared TS types for encrypted handles. |
| `ethers` | `^6.16.0` | v6 only — fhevm plugin pins v6 and v5 will mismatch typechain output. |
| `hardhat` | `^2.28.4` | v2 line. fhevm plugin peer-deps `hardhat@^2.0.0`. Do NOT use Hardhat 3 yet. |
| `solc` | `0.8.27` | Compiler version pinned by template (supports `^0.8.24+`). |
| Node.js | `>=20` | Matches fhevm-hardhat-template engines field. LTS, ESM-first. |

## Deprecated — do not use

| Package | Last Version | Replacement |
|---------|-------------|-------------|
| `fhevmjs` | `0.6.2` (deprecated 2025-07-10) | `@zama-fhe/relayer-sdk` |
| `fhevm` (root pkg) | `0.6.2` (deprecated 2025-07-10) | `@fhevm/solidity` |

## Incompatible — do not use yet

| Package | Reason |
|---------|--------|
| `hardhat@^3.x` | fhevm plugin peer-dep is `hardhat@^2.0.0`; v3 breaking config changes. Revisit Q3 2026. |
| `ethers@^5` | fhevm plugin pins ethers v6; v5 mismatches typechain output. |
<!-- @endsync -->

## Decryption Paths

<!-- @sync:prompt:decryption-paths -->
# Decryption Paths — Decision Tree

Zama Protocol exposes **three** ways to reveal an encrypted handle's plaintext. Choosing the wrong one leaks data or makes the dApp unusable. Always confirm with the user which path applies BEFORE generating decrypt logic.

## The three paths

### 1. Public decryption — `FHE.publicDecrypt`

- **Effect:** Plaintext becomes readable by anyone observing chain state.
- **Use when:** The result is intentionally public — e.g., final auction winner, vote tally, settled market price.
- **Trigger:** Solidity-side; result fanned out via the KMS network and indexed back into chain state.
- **Anti-use:** Never use for personal balances or private user inputs.

### 2. User decryption — relayer-sdk `userDecrypt` (client-side)

- **Effect:** Only the address holding the matching key can read plaintext. No other party (including the dApp deployer) sees it.
- **Use when:** Personal balances, private user inputs, per-user confidential state.
- **Trigger:** Frontend-side, using `@zama-fhe/relayer-sdk`. The contract must have called `FHE.allow(handle, userAddress)` first.
- **Anti-use:** Cannot be used for on-chain branching — value never returns to chain.

### 3. Oracle / async decryption — `FHE.requestDecryption` callback

- **Effect:** A relayer mediates an off-chain decryption and posts the plaintext back to a callback function on the contract.
- **Use when:** On-chain logic must conditionally branch on a plaintext value (e.g., compare two encrypted bids, settle a derivative, conditional transfers).
- **Trigger:** Solidity-side; relayer fulfills asynchronously. Has callback gas cost.
- **Anti-use:** Don't use for simple "show user their balance" — use path 2 instead (cheaper, more private).

## Decision rule

Ask the user which path applies BEFORE generating decrypt logic. **If unspecified, default-refuse and prompt for clarification.** Picking the wrong path is a privacy bug, not a feature gap.

## Cross-reference

Confirm the exact signature for the chosen path via context7 `/zama-ai/fhevm` `topic: "decryption"` — the API surface evolved across `@fhevm/solidity@0.10.x → 0.11.x` and the older examples on the open web are stale.
<!-- @endsync -->

# /zama-skills:frontend — Skeleton (Phase 1)

<!-- TODO: Phase 4 — flesh out frontend integration patterns -->

Frontend integration assistant. Phase 4 implements:

- `@zama-fhe/relayer-sdk` `SepoliaConfig` init
- `useDecrypted(handle)` React hook with "awaiting relayer" state
- Encrypted-input component pattern
- ethers v6 + typechain wiring (rejects v5 with explicit error)

Will REFUSE to emit imports of deprecated `fhevmjs` or root `fhevm` packages (sourced from `shared/deprecated-imports.json` once Phase 2 ships it).
