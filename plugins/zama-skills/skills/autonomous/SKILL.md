---
name: autonomous
description: One-command end-to-end pipeline. Runs design → init → contract → test → audit → deploy → frontend in sequence, pausing only at safety gates (audit findings, the disable-model-invocation deploy step, frontend smoke test). Best for first-time users who want a working confidential dApp without thinking about which skill comes next.
when_to_use: Trigger phrases include "do everything", "full pipeline", "build me a confidential dApp end to end", "auto", "I want the whole thing", "/zama-autonomous". Run when the user wants the complete chain in one go and is OK pausing at safety prompts. Do NOT run if the user is debugging a specific step (use `/zama-debug` instead) or only wants one part (use the specific skill directly).
allowed-tools: AskUserQuestion Read Write Edit Glob Grep Bash(node *) Bash(pnpm *) Bash(npx *) Bash(tsx *) Bash(git *)
---

## What this skill does

`/zama-autonomous` is the **end-to-end orchestrator**. One command, six follow-on skills, two safety gates. Best for:

- First-time users who don't yet know the skill chain
- Demos / hackathons where you want a deployed dApp in 30 minutes
- Anyone who wants to avoid typing eight slash commands in a row

It does NOT replace the individual skills — it just sequences them and asks the user before any irreversible step.

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

## Pipeline overview

```
[/zama-doctor]  ←  preflight (auto, exits if context7 missing)
       ↓
[/zama-design]  ←  describe your idea, get DESIGN.md + UI-WIREFRAME.md
       ↓
   ── pause ──   "Continue with this design?" Y/N
       ↓
[/zama-init]    ←  scaffold the monorepo
       ↓
[/zama-contract] ←  write the confidential contract (reads DESIGN.md)
       ↓
[/zama-test]    ←  generate mock + Sepolia tests
       ↓
[/zama-audit]   ←  ACL / cleartext / HCU / deprecation review
       ↓
   ── gate ──   audit clean (exit 0)?  yes → continue. warn/critical → ask user.
       ↓
[/zama-deploy]  ←  Sepolia deploy (manual confirm — skill is disable-model-invocation)
       ↓
[/zama-frontend] ← wire the UI
       ↓
   ── pause ──   "Ready to test? Open the frontend with `pnpm dev`."
       ↓
DONE
```

## Workflow (instructions for Claude executing this skill)

You are running `/zama-autonomous`. Follow this exact sequence. Never skip a gate.

### 1. State + resume

Check for an existing run in `.planning/v1-autonomous/state.json`. If present:

```
{
  "useCase": "private-voting",
  "completedSteps": ["doctor", "design", "init"],
  "currentStep": "contract",
  "startedAt": "2026-05-04T12:00:00Z"
}
```

Ask the user: "Resume from `<currentStep>` or start fresh?" If resume, jump to the named step. If fresh, delete the state file and start from step 2.

If no state file exists, create one with `completedSteps: []`, `currentStep: "doctor"`.

### 2. Preflight (`/zama-doctor` inline)

Run the diagnostic script directly:

```bash
bash ${CLAUDE_SKILL_DIR}/../doctor/scripts/diagnose.sh
```

If exit code is non-zero (required check failed), STOP. Tell the user:

> Setup not ready. Run the suggested fix commands above, then re-run `/zama-autonomous` to continue.

Update state: `currentStep: "design"`. Save.

### 3. `/zama-design`

Tell the user explicitly:

> Starting `/zama-design`. I'll ask you a few questions about your use-case, then generate `DESIGN.md` and `UI-WIREFRAME.md`.

Invoke the design skill (Claude Code will route automatically because the description matches). When it completes, read the generated `.planning/v1-design/<slug>/DESIGN.md` to confirm output is non-empty.

Update state: `completedSteps: [..., "design"], currentStep: "init"`. Save.

**GATE 1 — Design review:**

Show the user the first ~30 lines of DESIGN.md, then ask via AskUserQuestion:

- "Continue with this design?" → Yes / Edit DESIGN.md first / Cancel

If "Edit": pause, tell user to edit and re-run with `--resume`.
If "Cancel": exit cleanly.

### 4. `/zama-init`

Tell the user:

> Starting `/zama-init`. Use-case will be auto-suggested from DESIGN.md.

Invoke init. Wait for completion (closing summary contains "Next: /zama-contract").

Update state: `completedSteps: [..., "init"], currentStep: "contract"`. Save.

### 5. `/zama-contract`

Tell the user:

> Starting `/zama-contract`. Reading DESIGN.md for state schema and ACL plan.

Invoke contract. Wait for closing summary.

Update state: `completedSteps: [..., "contract"], currentStep: "test"`. Save.

### 6. `/zama-test`

Tell the user:

> Starting `/zama-test`. Will generate mock + Sepolia tests for the new contract.

Invoke test. Run `pnpm test` after to confirm the mock tests pass. If they fail, STOP and tell user to inspect.

Update state: `completedSteps: [..., "test"], currentStep: "audit"`. Save.

### 7. `/zama-audit`

Invoke audit on `packages/contracts/contracts/`. Capture exit code.

**GATE 2 — Audit verdict:**

- Exit 0 (clean): "Audit clean. Continuing to deploy." Update state, proceed.
- Exit 1 (warnings): Show warnings, ask "Continue to deploy anyway? (recommended: fix first via `/zama-debug` or `/zama-contract --regenerate`)" → Yes / Stop
- Exit 2 (critical): Show critical findings, refuse to continue. "Fix critical findings and re-run with `--resume`." Save state with `currentStep: "audit"` (so resume re-runs audit).

### 8. `/zama-deploy` — MANUAL confirm

This skill has `disable-model-invocation: true`. You CANNOT auto-invoke it. Tell the user explicitly:

> Ready to deploy to Sepolia. Because deploy is irreversible (real network, real testnet ETH), Claude Code requires you to explicitly type `/zama-deploy` to invoke it. I will pause here.

Wait for user to invoke `/zama-deploy` themselves. After they do, watch for the closing summary ("✅ /zama-deploy complete — Sepolia"). Update state.

### 9. `/zama-frontend`

Tell the user:

> Starting `/zama-frontend`. Will wire fhe.ts, useDecrypted hook, and EncryptedInput to the deployed contract address.

Invoke frontend. Wait for closing summary.

Update state: `completedSteps: [..., "frontend"], currentStep: "done"`. Save.

### 10. Final summary

Print:

```
🎉 Pipeline complete.

  Use-case:     <useCase>
  Contract:     <address> (<etherscan-url>)
  Frontend:     run `pnpm dev` from packages/frontend, then open localhost:3000

  Files of interest:
    .planning/v1-design/<slug>/DESIGN.md
    .planning/v1-design/<slug>/UI-WIREFRAME.md
    packages/contracts/contracts/<name>.sol
    packages/contracts/deployments/sepolia/<name>.json
    packages/frontend/src/components/

  Next: connect MetaMask (Sepolia network), interact, see encrypted balances decrypt.
```

Delete `.planning/v1-autonomous/state.json` (run is complete).

## Safety rules

- **Never auto-invoke `/zama-deploy`** — it's `disable-model-invocation: true` for a reason. The user must type the command themselves.
- **Never overwrite an existing scaffold without asking.** If `package.json` already exists in cwd, ask the user before continuing past `/zama-init`.
- **Never skip the audit gate.** Critical audit findings stop the pipeline.
- **Never write secrets to the state file.** State only contains the use-case slug and step progress.
- **Never spawn subagents.** This is a sequential orchestrator. Each skill runs in the same conversation context.

## Hard rules

- The state file lives at `.planning/v1-autonomous/state.json` and is the only file this skill writes outside of the downstream skills' outputs.
- This skill does not invoke `npm publish` or `git push` — those are out of scope.
- This skill does not run `/zama-debug` — if a step fails, it asks the user to handle it.

## Closing Summary

<!-- @sync:prompt:closing-summary-autonomous -->
<!-- closing-summary-autonomous.md -->

## ✅ /zama-autonomous — pipeline complete

### Run summary

- **Use-case:** `{{useCase}}`
- **Steps completed:** `{{stepsCompleted}}/{{stepsTotal}}`
- **Started:** `{{startedAt}}`
- **Completed:** `{{completedAt}}`

### What's live

- **Contract:** [`{{contractAddress}}`]({{etherscanUrl}})
- **Frontend:** run `pnpm dev` from `packages/frontend` → open `http://localhost:3000`

### Files of interest

- `{{designPath}}`
- `{{wireframePath}}`
- `{{contractPath}}`
- `{{deploymentPath}}`

### Next

- Connect MetaMask (Sepolia) on the frontend, mint, transfer, decrypt — verify the 4-state UX.
- If you hit any error during runtime: paste it into `/zama-debug`.
- If you want to bind Vercel for a public URL: see [`examples/confidential-token/VERCEL.md`](../../examples/confidential-token/VERCEL.md).
<!-- @endsync -->
