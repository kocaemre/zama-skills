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

# /zama-skills:test — Workflow

Generate **two** test files for an existing confidential contract in `packages/contracts/contracts/<Name>.sol`:

1. **`packages/contracts/test/<Name>.test.ts`** — mock unit test using `@fhevm/hardhat-plugin` encrypted-input mock + decrypt assertion + ACL re-decrypt verification.
2. **`packages/contracts/test/<Name>.sepolia.test.ts`** — Sepolia integration scaffold gated by `network.name`, headed by an HCU revert-risk warning, using `@zama-fhe/relayer-sdk` for real encryption.

> **HCU callout:** Mock tests do NOT enforce HCU (Homomorphic Compute Units). Sepolia enforces 20M HCU/tx + 5M depth. **Always run the Sepolia integration test before mainnet considerations** — a contract that passes mock tests can revert on Sepolia under HCU pressure.

## Step 1 — Pre-flight

Run the pre-flight script. Refuses to continue if the workspace is missing, ethers v5 is detected, or the target contract file does not exist:

```bash
tsx ${CLAUDE_SKILL_DIR}/scripts/lib/preflight.ts
```

Failure modes (each prints the exact remedy):

- `packages/contracts/contracts/` not found → "Run /zama-init first to scaffold the project."
- `ethers` ^5 in `packages/contracts/package.json` → "ethers v5 detected; /zama-test requires ethers v6"
- `@typechain/ethers-v5` present → same refusal

## Step 2 — Pick the target contract

Use `AskUserQuestion` to ask which contract to test. If exactly one `.sol` exists in `packages/contracts/contracts/`, surface it as the recommended default but still confirm.

```
Question: Which contract should I generate tests for?
Options:
  - <Name1>.sol (auto-detected)
  - <Name2>.sol
  - Other (type a name)
```

Optionally ask which state-write functions to cover (auto-detect via `Grep` for `function` declarations in the `.sol`):

```
Question: Which state-write functions should the mock test cover? (Enter to use auto-detected list.)
```

## Step 3 — Generate the two test files

```bash
tsx ${CLAUDE_SKILL_DIR}/scripts/generate.ts --contract <Name>
```

Add `--force` to overwrite existing test files (default: abort if either output already exists).

The generator reads `packages/contracts/contracts/<Name>.sol`, detects the first function with an `external` encrypted-input parameter (`externalEuint*` / `externalEbool` + `bytes` proof), and substitutes both templates.

## Step 4 — Closing summary

After generation, print:

```
✓ Generated:
  - packages/contracts/test/<Name>.test.ts        (mock — runs under `pnpm hardhat test`)
  - packages/contracts/test/<Name>.sepolia.test.ts (integration — runs under `pnpm hardhat test --network sepolia`)

ACL re-decrypt assertions: 1 per file
HCU header included in: <Name>.sepolia.test.ts

⚠ Mock tests do NOT enforce HCU. The Sepolia integration test is gated by
   `if (network.name !== "sepolia") this.skip();` — run it before mainnet.

Next: run /zama-deploy to deploy to Sepolia.
```

## Hard rules

- **NEVER emit ethers v5 syntax** — no `BigNumber.from`, no `ethers.utils.*`, no `ethers.providers.*`. Use ethers v6 (`hre.ethers`, `BigInt(...)` literals, `Provider` from `ethers`).
- **NEVER import `fhevmjs`.** Use `@zama-fhe/relayer-sdk` (frontend) or `fhevm` from `hardhat` (mock).
- **Both files MUST contain an ACL re-decrypt assertion.** The pattern: after a state-write call, decrypt the handle back via the same signer. If `FHE.allowThis` or `FHE.allow(handle, signer)` was missing, decrypt throws — turning a silent ACL bug into a loud test failure.
- **Output paths are hard-coded** to `packages/contracts/test/`. Do not write tests anywhere else.
- **Contract name must be PascalCase.** Reject names with slashes, dots, or path traversal.


## Closing Summary

<!-- @sync:prompt:closing-summary-test -->
<!-- closing-summary-test.md
     Rendered after /zama-test finishes. Substituted via
     `renderClosingSummary('test', vars)` from skills/_lib/closing-summary.ts
     and transcluded into SKILL.md via `@sync:prompt:closing-summary-test`.
     Placeholder syntax: {{key}}. -->

## ✅ /zama-test complete — tests for `{{name}}`

### What was generated

- **Mock test (unit):** `{{mockPath}}`
- **Sepolia test (integration):** `{{sepoliaPath}}`
- **ACL re-decrypt assertions:** `{{aclAssertCount}}`
- **HCU revert risk:** noted in Sepolia test header (relayer can revert if a tx exceeds the HCU budget; see comments)

### Pattern coverage

Both files use the canonical **encrypt-input → call → await decrypt → assert** flow. Mock tests use `@fhevm/hardhat-plugin` mock-utils for fast in-process decryption; Sepolia tests use the real relayer.

> context7 verified the test API surface against `/zama-ai/fhevm-hardhat-template` — pinned versions match `@fhevm/hardhat-plugin@^0.4.2`.

### Next: run `/zama-deploy` to ship `{{name}}` to Sepolia.
<!-- @endsync -->
