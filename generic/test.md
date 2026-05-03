> Auto-generated from plugins/zama-skills/skills/test/SKILL.md — do not edit manually. Run `pnpm sync` to regenerate.

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

## ACL Pattern Reminder

<!-- @sync:snippet:acl-tip -->
# ACL Pattern Reminder

The Zama Protocol Access Control List (ACL) governs which addresses may decrypt a given encrypted handle (`euint*`, `ebool`, `eaddress`).

## Rule of thumb

Every state-write that produces or stores an encrypted handle MUST be followed by an ACL grant in the same transaction:

- `FHE.allowThis(handle)` — required so the contract itself can read the handle in subsequent calls. Forgetting this breaks future reads.
- `FHE.allow(handle, msg.sender)` — required if the caller needs to **user-decrypt** the value later via the relayer SDK.
- `FHE.allow(handle, otherAddress)` — grant decryption to a third party (e.g., counterparty in an auction settlement).

## Reference

- Library: `@fhevm/solidity@^0.11.1` ACL primitives (`FHE.allowThis`, `FHE.allow`, `FHE.makePubliclyDecryptable`).
- The ACL pattern **changed in `@fhevm/solidity@0.11.x`** — older examples (0.10.x and earlier) use a different API surface.
- Always verify the current signature via context7 `/zama-ai/fhevm` `topic: "acl"` before generating new patterns.

## Common mistake

Writing `state.balance = FHE.add(state.balance, amount)` without `FHE.allowThis(state.balance)` afterwards leaves the contract unable to read its own state next call. This will silently fail downstream.
<!-- @endsync -->

# /zama-skills:test — Skeleton (Phase 1)

<!-- TODO: Phase 4 — flesh out FHE test patterns -->

FHE test pattern generator. Phase 4 implements:

- Mock test pattern (`@fhevm/hardhat-plugin` encrypted-input mock + decrypt)
- Sepolia integration test scaffold (real deploy + real encrypted input)
- `FHE.allowThis` verification (post-call decrypt confirmation)
- HCU budget warning (mock won't catch overruns; Sepolia reverts)
