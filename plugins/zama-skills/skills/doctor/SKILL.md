---
name: zama-doctor
description: Diagnose the user's Claude Code environment for Zama-skills readiness — checks Node, pnpm, git, MCP servers (context7 required, magic recommended), Sepolia connectivity, and skill plugin install status. Read-only; never modifies anything.
when_to_use: Trigger phrases include "zama doctor", "check zama setup", "what's missing", "why isn't /zama-init working", "diagnose zama", "/zama-doctor". Run when a user reports a setup-time error or before the first-time install. Also run as a quick first step when any other zama-skill complains about a missing dependency.
allowed-tools: Bash(node *) Bash(pnpm *) Bash(npm *) Bash(git *) Bash(curl *) Bash(claude *) Bash(which *) Read Glob Grep
---

## What this skill does

`/zama-doctor` is a **read-only** diagnostic. It runs a series of checks and prints a single report — pass / fail per item — with the exact install command for anything missing. It never installs anything itself, never modifies your project, never writes secrets.

Use it when:

- You just installed `zama-skills` and want to confirm everything is ready.
- Another skill (e.g. `/zama-init`) failed with a missing-dependency error and you want a full picture.
- You want to know whether the optional `magic` MCP would improve your output.

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

<!-- @sync:prompt:ask-user-question-style -->
# AskUserQuestion phrasing rules

Apply these rules to **every** `AskUserQuestion` invocation in any skill, in any language the user is conversing in.

## Question text

- **Always** start the question with a Capital Letter, even after translation. If the session is in Turkish/French/etc., translate the question naturally but preserve the leading capital.
- Always end the question with `?`.
- Keep the question short — one line is ideal, never more than two.
- Phrase as a real question, not a directive ("Pick a stack" → "Which stack do you want?").

## Options

- Each option label starts with a Capital Letter (or matches the existing kebab-case identifier — `confidential-token` is fine, `Confidential-token` is wrong).
- Add a one-line "what this means" after every option. If you can't describe it in one line, drop the option.
- Mark the most common pick with a trailing **`(recommended)`** tag (or, when context-specific, **`(recommended for first-timers)`** / **`(default)`**). Saves the user from research.
- Never have more than 6 options on a single-select. Group / collapse if you do.

## Free-form text input

- Same capitalization rule on the prompt text.
- Give a one-line example after the prompt: e.g. `"Pick a kebab-case slug for the project."` → followed by `(e.g., private-payroll)`.

## Bad / good examples

| Bad | Good |
|---|---|
| `what category?` | `Which category fits your idea best?` |
| `confidential-token: tokens` | `confidential-token` — value transfer with hidden balances. **(recommended for first-timers)** |
| `give me the slug` | `Pick a kebab-case slug for the project.` *(e.g., `private-payroll`)* |
| (no description on an option) | every option has a one-liner, no exceptions |
<!-- @endsync -->

## Documentation Authority

`/zama-doctor` does not generate code, so it does not call context7 itself — but one of the things it checks is whether context7 is installed for the **other** skills.

## What gets checked

| Category | Check | Required? |
|----------|-------|-----------|
| Runtime | Node.js >= 20 | ✅ required |
| Runtime | pnpm available on PATH | ✅ required |
| Runtime | git available on PATH | ✅ required |
| MCP | `context7` MCP server installed (`claude mcp list \| grep context7`) | ✅ required |
| MCP | `magic` (21st.dev) MCP server installed | ⚪ recommended |
| Network | Sepolia public RPC reachable (one of the public endpoints) | ⚪ recommended (only needed for `/zama-deploy`) |
| Network | Zama relayer reachable (`https://relayer.testnet.zama.org`) | ⚪ recommended (only needed for `/zama-frontend` integration tests) |
| Plugin | `zama-skills` plugin installed in Claude Code | ⚪ informational |
| Project | Current dir has `package.json` (would `/zama-init` overwrite something?) | ⚪ informational |

For each failed check the output includes the exact one-line install / fix command.

## Workflow

1. Run `${CLAUDE_SKILL_DIR}/scripts/diagnose.sh` — it executes every check above and prints a structured report to stdout.
2. Tell the user the bottom-line verdict in plain English:

   - **All required checks pass + recommended pass:** "You're ready. Try `/zama-design` or `/zama-init`."
   - **Required pass, recommended missing:** "Ready to scaffold. To improve output (or run deploy / frontend later), install: `<commands>`."
   - **Required missing:** "Setup incomplete. Run these commands and re-run `/zama-doctor`:" then list the install commands.

3. Do NOT run any install commands yourself. The user runs them.

## Hard rules

- This skill writes no files outside `/tmp` (which it doesn't write to either).
- It never spawns subagents.
- It never modifies `package.json`, `.env`, or git config.
- It never passes secrets via shell args.

## Closing Summary

<!-- @sync:prompt:closing-summary-doctor -->
<!-- closing-summary-doctor.md -->

## ✅ /zama-doctor — diagnostic complete

### Summary

- **Required:** `{{requiredOk}}/{{requiredTotal}}` passing
- **Recommended:** `{{recommendedOk}}/{{recommendedTotal}}` passing
- **Verdict:** `{{verdict}}`

### Next

- If everything green: `/zama-design` (plan from idea) or `/zama-init` (scaffold a known use-case).
- If anything red: run the install commands printed above, then re-run `/zama-doctor`.
<!-- @endsync -->
