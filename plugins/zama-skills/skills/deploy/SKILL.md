---
name: zama-deploy
description: Deploy compiled fhEVM contracts to Sepolia testnet, verify on Etherscan, and (if applicable) auto-register with the Confidential Token Registry. Use ONLY when the user explicitly asks to deploy.
when_to_use: User has compiled contracts and explicitly types "/zama-deploy" or asks to deploy to Sepolia. Never auto-invoke — destructive on-chain action.
disable-model-invocation: true
allowed-tools: AskUserQuestion Bash(pnpm hardhat *) Bash(npx hardhat *) Bash(pnpm tsx *) Bash(npx tsx *) Bash(node *) Bash(cat *) Bash(ls *) Read Write Edit WebFetch
---


## MCP Prerequisites

<!-- @sync:prompt:mcp-prerequisite -->
# Required & recommended MCP servers

This skill talks to two MCP servers. The first is **required**; the second is **recommended** for higher-quality UI output.

| MCP | Status | Why | Install |
|-----|--------|-----|---------|
| `context7` | **REQUIRED** | Live Zama / OpenZeppelin Confidential / fhEVM docs (anti-hallucination guarantee) | `claude mcp add context7 -- npx -y @upstash/context7-mcp` |
| `magic` (21st.dev) | **RECOMMENDED** for `/zama-frontend` and `/zama-design` | Production-grade UI component scaffolding (shadcn-flavored, design-system-aware) | `claude mcp add magic -- npx -y @21st-dev/magic` (sign-in required) |

## Detection (mandatory — run BEFORE code generation)

Before invoking any `mcp__context7__*` or `mcp__magic__*` tool, verify the tool is available. If a `context7` call would fail (tool not found / not in the available tool list):

1. **STOP**. Do NOT generate any code or write any file.
2. Tell the user (verbatim, do not paraphrase):

   ```
   This skill requires the context7 MCP server to fetch live Zama documentation.
   It does not appear to be installed.

   Install it (one-time setup):

       claude mcp add context7 -- npx -y @upstash/context7-mcp

   After install, restart Claude Code (or run /mcp to verify) and re-run this skill.
   ```

3. Wait for the user to confirm install. Re-attempt the call. If it still fails, tell the user to run `/zama-doctor` for a full diagnostic.

If a `magic` call would fail (only relevant for `/zama-frontend` and `/zama-design` UI generation):

1. Do NOT stop — magic is optional. Continue with hand-authored shadcn components.
2. Tell the user (once, near the start of UI generation):

   ```
   Magic MCP (21st.dev) is not installed. UI components will be hand-authored
   using shadcn primitives. For higher-quality, design-system-aware components,
   install Magic:

       claude mcp add magic -- npx -y @21st-dev/magic

   Then restart Claude Code and re-run this skill.
   ```

3. Continue without magic.

## No fallback for context7

context7 is hard-required. Every Zama / OpenZeppelin / fhEVM API the skill emits is verified against `/zama-ai/fhevm` (1772 HIGH-reputation snippets) and `/websites/openzeppelin_confidential-contracts` (354 snippets). A WebFetch fallback would weaken the anti-hallucination guarantee — if context7 is unavailable, the right answer is to fix the setup, not to silently degrade.

## When in doubt

Run `/zama-doctor` — it lists every required and recommended MCP/tool with install commands and a status check.
<!-- @endsync -->

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

## Sepolia Setup

<!-- @sync:snippet:sepolia-faucet -->
# Sepolia Setup — URLs Only

> **Never hardcode contract addresses in generated code.** Zama updates ACL / KMS / Coprocessor / Confidential Token Registry addresses periodically. Skills MUST WebFetch the live registry at runtime.

## Live address registry (fetch at runtime)

- **URL:** `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia`
- **Contract:** Skill MUST WebFetch this URL at runtime; never pin in source.

## Sepolia faucets (request testnet ETH)

- `https://sepoliafaucet.com/` (Alchemy)
- `https://www.infura.io/faucet/sepolia` (Infura)
- `https://faucet.quicknode.com/ethereum/sepolia` (QuickNode)

## RPC provider env-var pattern

Use the env-var convention from `fhevm-hardhat-template`:

- `INFURA_API_KEY` — for Infura Sepolia RPC
- `ALCHEMY_API_KEY` — for Alchemy Sepolia RPC
- `MNEMONIC` — for the deployer wallet (BIP-39 phrase, never commit)

## Relayer URL

Confirm the **current relayer URL** via context7 `/zama-ai/fhevm` `topic: "relayer"` before emitting any relayer-sdk init code. The URL has historically been `https://relayer.testnet.zama.org` but treat it as runtime-fetched, not source-pinned.

## Hard rule

**Never include hardcoded ACL, KMS, Coprocessor, or Confidential Token Registry addresses in generated code.** Read them from a runtime config object populated by a WebFetch of the registry URL above, or from the relayer SDK's auto-discovery if available.
<!-- @endsync -->

## Closing Summary

<!-- @sync:prompt:closing-summary-deploy -->
<!-- closing-summary-deploy.md
     Rendered after /zama-deploy finishes. Substituted via
     `renderClosingSummary('deploy', vars)` from skills/_lib/closing-summary.ts
     and transcluded into SKILL.md via `@sync:prompt:closing-summary-deploy`.
     Placeholder syntax: {{key}}. -->

## ✅ /zama-deploy complete — Sepolia

### Deployment

- **Address:** `{{address}}` ([Etherscan]({{etherscanUrl}}))
- **Verification:** `{{verifyStatus}}`
- **Confidential Token Registry:** `{{registryStatus}}`
- **ABI exported:** `{{abiPath}}`

### Frontend env reminder

Add the deployed address to `packages/frontend/.env`:

```env
VITE_{{NAME_UPPER}}_ADDRESS={{address}}
```

> Sepolia ACL/KMS/Coprocessor addresses were fetched LIVE from `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` — never pinned in source.

### Next: run `/zama-frontend` to wire UI hooks to `{{address}}`.
<!-- @endsync -->

# /zama-deploy — Sepolia Deploy + Verify + Register Workflow

> **`disable-model-invocation: true`** — Claude **MUST NEVER** auto-invoke this skill. The user must explicitly type `/zama-deploy` or unambiguously request a Sepolia deployment. This is a destructive on-chain action: real (test) ETH is spent, contracts become world-visible, and accidental mainnet pushes are unrecoverable.

## ⛔ ABORT-IF-MAINNET

Before sending any transaction, the skill MUST verify the active Hardhat network is `sepolia` AND the resolved chainId is **`11155111`**. If either check fails — including chainId `1` (Ethereum mainnet), `137` (Polygon), `8453` (Base), or any other value — the skill MUST refuse with:

> **ABORT: not Sepolia.** This skill only deploys to Sepolia (chainId `11155111`). Detected `<network>` (chainId `<id>`). Mainnet/other-chain deploys are out of scope for v1.

This check fires in `preflight.ts` (config-level) AND inside `deploy.ts` (runtime, after `ethers.provider.getNetwork()`).

## Workflow — 8 steps in strict order

### Step 0 — Confirmation prompt (always)

Before any other action, the skill MUST display a confirmation card and call `AskUserQuestion`:

```
About to deploy to Sepolia (chainId 11155111).

  Contract:        <Name>
  Constructor args: <args | "(none)">
  Deployer:        <0x... — first 6 + last 4 of address derived from MNEMONIC/PRIVATE_KEY>
  RPC:             <SEPOLIA_RPC_URL host only, no API key>
  Etherscan verify: <yes | skipped (no ETHERSCAN_API_KEY)>

Proceed?  [yes / no]
```

If the user answers anything other than an unambiguous "yes" → STOP. Do not run any subsequent step.

### Step 1 — env-validate

Run `Bash(node ${CLAUDE_SKILL_DIR}/scripts/lib/env-validate.ts)` (the script auto-loads `.env`). On failure the script exits non-zero and prints a **named-missing list**, e.g.:

```
✗ env-validate failed. Missing required env vars:
  - SEPOLIA_RPC_URL
  - ETHERSCAN_API_KEY
  - MNEMONIC|PRIVATE_KEY  (need at least one)
```

If non-zero exit → **STOP**. Skill prints the named list verbatim and a one-liner: "Add the missing vars to `.env` then re-run `/zama-deploy`." No compile, no deploy.

### Step 2 — Compile

`Bash(pnpm hardhat compile)`. On non-zero exit, STOP and surface the compiler diagnostics. Do not attempt to deploy uncompiled artifacts.

### Step 3 — Deploy

`Bash(pnpm hardhat run --network sepolia scripts/deploy/<Name>.ts)` — or, equivalently, the orchestrator `Bash(node ${CLAUDE_SKILL_DIR}/scripts/deploy.ts --contract <Name>)`.

The script must print one canonical line that the orchestrator regex-captures:

```
Deployed at: 0xabc...def
```

Capture: `address` and the deploy `txHash`.

### Step 4 — Verify on Etherscan

`Bash(pnpm hardhat verify --network sepolia <address> <constructorArgs...>)`.

Retry **once** on rate-limit (HTTP 429 / `Max calls per sec`). On persistent failure, print a warning ("Etherscan verification skipped: <reason>. Verify manually with: pnpm hardhat verify --network sepolia <address> ...") and continue — verification failure must NOT abort downstream steps.

### Step 5 — Confidential Token Registry registration (conditional)

Detection: skill greps the contract source — `Bash(grep -l 'is ERC7984' packages/contracts/contracts/<Name>.sol)`.

If a hit:
1. `Bash(node ${CLAUDE_SKILL_DIR}/scripts/lib/sepolia-addresses.ts)` — fetch the live Zama Sepolia address registry via `WebFetch https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia`. The script writes `.cache/zama-addresses.json` (24-hour TTL); warm cache is reused without WebFetch. **No registry address is ever pinned in skill source.**
2. Materialize the registration template `${CLAUDE_SKILL_DIR}/assets/templates/register-token.ts.tpl` into `scripts/register-token.ts` (substituting `{{TOKEN_ADDRESS}}` and `{{REGISTRY_ADDRESS}}` from the cache).
3. `Bash(pnpm hardhat run --network sepolia scripts/register-token.ts)`. Capture `registryTxHash`.

If no `is ERC7984` match → skip Step 5 entirely with a one-line note: "Skipping Confidential Token Registry: contract is not ERC7984."

### Step 6 — ABI export

`Bash(node ${CLAUDE_SKILL_DIR}/scripts/lib/abi-export.ts <Name> <address>)` reads `artifacts/contracts/<Name>.sol/<Name>.json` and writes `packages/frontend/src/abis/<Name>.json`:

```json
{
  "abi": [...],
  "bytecode": "0x...",
  "address": "0xabc...",
  "network": "sepolia"
}
```

### Step 7 — Closing summary

Print to the user:

```
## /zama-deploy complete

### Deployed
- Contract:   <Name>
- Address:    <address>
- Etherscan:  https://sepolia.etherscan.io/address/<address>
- Tx:         https://sepolia.etherscan.io/tx/<txHash>

### Confidential Token Registry
<one of:>
- Registered: https://sepolia.etherscan.io/tx/<registryTxHash>
- Skipped:    contract is not ERC7984

### ABI export
- packages/frontend/src/abis/<Name>.json

### Frontend env reminder
Update `packages/frontend/.env`:

  VITE_<NAME_UPPER>_ADDRESS=<address>
  VITE_<NAME_UPPER>_NETWORK=sepolia

### What was NOT done
- I did NOT push commits or open a PR — review `git status` and commit yourself.
- I did NOT deploy to mainnet — out of scope for v1.

### Recommended next skill
/zama-frontend — wire the deployed address into a React UI hook.
```

The skill ends here. Do not chain into another skill automatically.

## Hard refusals

- **Mainnet** (chainId !== 11155111) → ABORT-IF-MAINNET callout above.
- **Missing `.env`** → STOP at Step 1 with named missing list. No compile, no deploy.
- **Pinned Sepolia addresses in repo source** → forbidden. Always WebFetch via `sepolia-addresses.ts` (cached to `.cache/zama-addresses.json`, which `/zama-init` adds to `.gitignore`).
- **`pnpm add` of any package** → forbidden. All deps come from `shared/pinned-versions.json` via `/zama-init`. The deploy skill never modifies `package.json`.
- **Hardhat 3.x or ethers v5** → preflight refuses with the deprecation guard above.
