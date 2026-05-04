---
name: init
description: Scaffold a new confidential dApp from the official fhevm-react-template, customized for the user's chosen use-case (token, voting, auction, custom). Use when the user wants to bootstrap a new Zama Protocol / fhEVM project from scratch.
when_to_use: Trigger phrases include "init zama project", "new fhevm dapp", "scaffold confidential token", "start zama", "bootstrap confidential dapp". Run when working in an empty or near-empty directory.
context: fork
allowed-tools: Bash(git *) Bash(npm *) Bash(npx *) Bash(mkdir *) Bash(cp *) Read Write Edit Glob Grep WebFetch
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

Confirm the **current relayer URL** via context7 `/zama-ai/fhevm` `topic: "relayer"` before emitting any relayer-sdk init code. The URL has historically been `https://relayer.testnet.zama.cloud` but treat it as runtime-fetched, not source-pinned.

## Hard rule

**Never include hardcoded ACL, KMS, Coprocessor, or Confidential Token Registry addresses in generated code.** Read them from a runtime config object populated by a WebFetch of the registry URL above, or from the relayer SDK's auto-discovery if available.
<!-- @endsync -->

## Closing Summary

<!-- @sync:prompt:closing-summary -->
# Closing Summary — Skill End Reporting Template

When a skill finishes its primary action, print a structured summary so the user knows exactly what changed, what's pinned, and what to do next.

## Template

```
## ✅ {{SKILL_NAME}} complete

### What was created/installed
{{INSTALLED_FILES}}

### Pinned versions used
{{VERSIONS_TABLE}}  ← the skill substitutes the table from `shared/snippets/versions-table.md` at runtime

### Sepolia next steps
{{SEPOLIA_FAUCET}}  ← the skill substitutes the URLs from `shared/snippets/sepolia-faucet.md` at runtime

Add Sepolia to MetaMask: https://chainid.network/?search=sepolia

### What was NOT done
{{NOT_DONE_LIST}}

### Recommended next skill
{{NEXT_SKILL}} — {{NEXT_SKILL_REASON}}
```

## Placeholder reference

| Token | Meaning | Example |
|-------|---------|---------|
| `{{SKILL_NAME}}` | Name of the skill that just ran | `/zama-init` |
| `{{INSTALLED_FILES}}` | Bulleted list of files created or modified | `- contracts/MyToken.sol` |
| `{{NOT_DONE_LIST}}` | Explicit list of deferred actions, one per line | `- I did NOT deploy yet — run /zama-deploy when ready` |
| `{{NEXT_SKILL}}` | Slash-command name of the next skill to run | `/zama-contract` |
| `{{NEXT_SKILL_REASON}}` | One-line rationale for the recommendation | `scaffold an ERC-7984 confidential token` |

## Rules

- **Always** include the "What was NOT done" section. Skills must be honest about scope — never imply work was completed when it was deferred.
- **Always** substitute `{{VERSIONS_TABLE}}` and `{{SEPOLIA_FAUCET}}` at skill runtime by reading the canonical snippets from `shared/snippets/versions-table.md` and `shared/snippets/sepolia-faucet.md`. Do not inline them in this template.
- The skill runtime substitutes `{{...}}` placeholders before printing.
<!-- @endsync -->

# /zama-init — Workflow

This skill scaffolds a deprecation-free, compile-green confidential dApp into `./<use-case>-dapp/` under the user's current directory. The flow is deterministic: pre-flight checks → ask the use-case → materialize templates with pinned versions → install + compile → grep guardrail → closing summary. Every dependency pin is sourced from `plugins/zama-skills/shared/pinned-versions.json` (npm-registry-verified) and the context7 sources cited above — no LLM-invented APIs, no deprecated imports, no hardcoded Sepolia addresses. The skill stops at compile-green; it does NOT deploy.

## Step 1 — Pre-flight checks

Run `${CLAUDE_SKILL_DIR}/scripts/preflight.ts` via Bash. The script verifies Node `>=20`, `pnpm` on `PATH`, write access to the current working directory, and a lightweight context7 reachability ping. If it exits non-zero, print the helper's stderr verbatim and **STOP** — do not proceed to Step 2. Pre-flight is a hard gate; never "best-effort" past it.

## Step 2 — Ask the use-case

Use the `AskUserQuestion` tool with a single-select question titled "Which confidential dApp do you want to scaffold?" and the four options below. Each option ships a one-line "what you'll get" summary so the user picks without docs lookup:

- `confidential-token` — minimal `ERC7984ERC20Wrapper` with mint/transfer demo (uses `@openzeppelin/confidential-contracts`).
- `voting` — `VotesConfidential` poll with confidential ballots and snapshot-based tallying.
- `auction` — sealed-bid auction over `euint64` with `FHE.le`/`FHE.select` winner selection (no OZ primitive).
- `custom` — empty skeleton with `@fhevm/solidity` imports, ACL reminders, and deprecation-guard comment block.

Capture the answer as `<use-case>` — every downstream step substitutes it.

## Step 3 — Scaffold

Run `${CLAUDE_SKILL_DIR}/scripts/scaffold.ts --use-case <use-case> --target ./<use-case>-dapp` via Bash. The helper:

- Materializes `${CLAUDE_SKILL_DIR}/assets/templates/**` into the target directory, resolving every `<!-- @pin:<pkg> -->` placeholder against `shared/pinned-versions.json` via `getVersion(pkg)`.
- Copies `${CLAUDE_SKILL_DIR}/assets/seeds/<use-case>/*.sol` into `packages/contracts/contracts/`.
- Emits `.env.example`, `README.md` (with the 30-second value prop on top), and `.gitignore`.
- Writes a JSON manifest to stdout describing every file written (consumed by Step 6).

If the target directory exists and is non-empty, the script refuses unless invoked with `--force` — surface the refusal to the user and ask before re-running. On any other non-zero exit, print stderr and **STOP**.

## Step 4 — Install + compile

`cd <use-case>-dapp && pnpm install` — stream progress to the user. On failure, suggest `pnpm install --frozen-lockfile=false` exactly once; if that also fails, **STOP** and report the install log. Then run `pnpm hardhat compile`. On compile failure, run `pnpm hardhat clean && pnpm hardhat compile` exactly once. If that still fails, query context7 (`mcp__context7__get-library-docs` with `context7CompatibleLibraryId: "/zama-ai/fhevm"` and a `topic` derived from the Solidity error) and present findings to the user — do NOT auto-iterate further. Compile-green is the success gate for this step.

## Step 5 — Deprecation belt-and-suspenders grep

Run `${CLAUDE_SKILL_DIR}/scripts/scaffold.ts --post-grep ./<use-case>-dapp`. The helper recursively scans the materialized output for `fhevmjs` and `"fhevm":` (root package). Any hit means a template or seed leaked a deprecated import — **ABORT** with the offending file + line number and instruct the user to file an issue. This guardrail must never fire if Phase 2/3 templates are correct; it exists so a future regression fails loud instead of silently shipping deprecated code.

## Step 6 — Closing summary

Invoke `${CLAUDE_SKILL_DIR}/scripts/closing-summary.ts --manifest <stdout-from-step-3> --use-case <use-case>` and render the markdown block exactly as the script returns it. The summary MUST contain:

- File inventory grouped by directory (`packages/contracts/`, `packages/frontend/`, root).
- Commands that already passed (`pnpm install`, `pnpm hardhat compile`).
- MetaMask Sepolia deep-link: `https://chainid.network/?search=sepolia` (rendered as a clickable link).
- Three faucet URLs sourced from the `@sync:snippet:sepolia-faucet` block above.
- Next-3-actions: `/zama-contract` (extend the seed contract), `/zama-test` (generate FHE-aware tests), `/zama-deploy --sepolia` (deploy + verify) — each with a one-line rationale.
- An explicit line: **"I did NOT deploy — run `/zama-deploy --sepolia` when your `.env` is filled in."**
- The verification line: **"context7 was queried at scaffold time — every dependency pin is verified live, no hallucinated APIs."**

## Boundary contract

- This skill **scaffolds**. It does NOT deploy. Deployment lives in `/zama-deploy` (Phase 4) and is gated by `disable-model-invocation: true` so Claude cannot trigger it autonomously.
- This skill writes only to `./<use-case>-dapp/` under the current working directory. It refuses to overwrite a non-empty target without an explicit user `--force` confirmation.
- This skill never edits files outside the target directory and never modifies the user's global `pnpm` / `npm` / git config.

## Hard rules

- Never emit a deprecated package name. Cross-reference the **Deprecation Guard** snippet above; `fhevmjs` and root-pkg `fhevm` are absolute refusals.
- Never hardcode Sepolia ACL/KMS/Coprocessor/Registry addresses. Cross-reference the **Sepolia Setup** snippet — addresses are runtime-fetched from the live registry URL.
- Pinned versions come from `shared/pinned-versions.json` only. Treat context7 doc snippets as API guidance, never as version truth.
- On any pre-flight failure (Step 1) or post-grep hit (Step 5): **STOP**. Do not attempt partial recovery or "best-effort" continuation — these gates are non-negotiable.
