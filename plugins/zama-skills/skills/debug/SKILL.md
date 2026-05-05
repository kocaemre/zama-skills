---
name: zama-debug
description: Diagnose fhEVM / Zama Protocol errors from a pasted revert message, vitest failure, hardhat trace, or runtime exception. Matches the input against a curated catalog of known patterns (ACL grants, deprecated fhevmjs/fhevm imports, HCU exhaustion, relayer SSR/indexedDB, Etherscan v1, relayer 502, wagmi ABI drift, ZamaConfig path, SDK init undefined, EIP-712 type mismatch, KMS key mismatch, and more) and returns a likely root cause, concrete fix command(s), and an authoritative reference link.
when_to_use: Trigger when the user pastes any of the strings "ACL: not allowed", "Cannot read properties of undefined (reading 'initSDK')", "Module not found 'fhevmjs'", "Module not found 'fhevm'", "HCU exceeded", "BAILOUT_TO_CLIENT_SIDE_RENDERING", "indexedDB is not defined", "Etherscan: V1 endpoint deprecated", "relayer 502", "useReadContract undefined", or "ZamaEthereumConfig not found". Also trigger when they say "debug fhevm error", "diagnose fhe", "/zama-debug", "what does this fhevm error mean", or paste a hardhat / vitest / next stack trace mentioning fhe / zama / euint / relayer.
allowed-tools: AskUserQuestion Read Bash(node *) Bash(npx *) Bash(tsx *) Grep
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

If a `magic` call would fail (only relevant for `/zama-frontend`, `/zama-init`, and `/zama-design` UI generation):

1. Do NOT stop — magic is optional. The skills ship a complete Tailwind + shadcn-style scaffold without it (see `assets/templates/ui/` and `assets/templates/panels/`).
2. Use `AskUserQuestion` **once per session** near the start of UI generation:

   - **Question**: "Install Magic MCP for richer UI components? (one-time, requires 21st.dev sign-in)"
   - **Options**:
     - `Yes — install now`: run `claude mcp add magic -- npx -y @21st-dev/magic` via Bash, then tell the user to restart Claude Code so the new MCP is registered, and continue this run with the built-in templates (Magic becomes available on the *next* invocation).
     - `Skip`: continue without Magic — the built-in Tailwind primitives are already production-quality.

3. After the answer, continue UI generation regardless. Do NOT block UI work on Magic — the templates produce a complete, polished dApp on their own.

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
- **Adapt the question to what the user already said.** If a previous answer (or a free-form description like `<one_liner>`) is in scope, splice a 1-3-word reference from it into the next question. Generic "Which stack do you want?" becomes "Which stack do you want for **your private payroll dApp**?". This makes the conversation feel like the skill listened, not like a fixed survey.

## Options

- Each option label starts with a Capital Letter (or matches the existing kebab-case identifier — `confidential-token` is fine, `Confidential-token` is wrong).
- Add a one-line "what this means" after every option. If you can't describe it in one line, drop the option.
- Mark the most common pick with a trailing **`(recommended)`** tag (or, when context-specific, **`(recommended — your idea suggests this)`** / **`(default)`**). Saves the user from research.
- **Filter options by what the user already said.** If they described a payroll dApp, don't show `auction` and `prediction-market` as options — drop them. Keep ≤5 options per question. Always keep at least: the heuristic match, the next two most likely alternatives, and a fallback (`custom` / `other`).
- Never have more than 6 options on a single-select.

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

# /zama-debug — Workflow

This skill turns a pasted error message / stack trace into an actionable
diagnosis. The pattern catalog lives at `assets/PATTERNS.md` (mirror of
`scripts/lib/patterns.ts`) — 10 high-frequency fhEVM failure modes.

## Step 1 — Collect the error text

Use **`AskUserQuestion`** with a single free-text prompt:

> Paste the full error message — including the stack trace if you have
> it. The more lines, the better the match. Truncated one-liners often
> miss because the unique signal lives a few frames down.

If the user has a log file on disk, accept a path instead and read it
with `Read`. Either way, hold the raw text in memory for Step 2.

## Step 2 — Diagnose

Invoke the matcher CLI:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/diagnose.ts --error "$(printf '%s' "$ERROR_TEXT")"
```

Or, if the text is in a file:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/diagnose.ts --file path/to/error.log
```

The script:

- Returns exit `0` on a match and prints a markdown block with
  **Likely cause**, **Fix** (numbered steps; commands prefixed with `$`),
  and a **Reference** link.
- Returns exit `1` on no match and prints next-step guidance
  (re-paste full trace, search docs, query context7).
- Returns exit `2` on usage error.

Surface the printed markdown verbatim to the user.

## Step 3 — When no pattern matches

Do **not** fabricate a fix. Instead:

1. Ask the user to re-paste the full stack (truncation is the #1 cause
   of false misses).
2. Use the AskUserQuestion form to ask which surface area is involved
   (Solidity compile, Hardhat test, Sepolia tx, browser SDK, Next.js
   build).
3. Run a targeted `mcp__context7__get-library-docs` query against
   `/zama-ai/fhevm` with a tight `topic` (e.g., `topic: "decryption"`,
   `topic: "acl"`, `topic: "sepolia"`).
4. Only then propose a tentative fix — and label it explicitly as
   "unverified — please confirm against your repo".

## Step 4 — Refusal contract for deprecated packages

The catalog already contains `deprecated-fhevmjs` and
`deprecated-fhevm-root`. If a diagnosis lands on either:

- **Refuse** to suggest a workaround, version pin, or "last known good"
  fallback for the deprecated package.
- Emit only the canonical replacement command from the catalog
  (`@zama-fhe/relayer-sdk@^0.4.2` and `@fhevm/solidity@^0.11.1`
  respectively).
- Add a one-line code comment in any patch you propose explaining the
  replacement (`// fhevmjs deprecated 2025-07-10; using @zama-fhe/relayer-sdk`).

## Step 5 — Closing summary

After printing the diagnosis, append:

```
---
Pattern matched: <pattern-name>
Catalog: assets/PATTERNS.md (10 entries)
If this didn't fix it, re-paste the full stack — truncation is the #1 cause of misses.
```

## Extending the catalog

Add new patterns by:

1. Appending a `DebugPattern` entry to `scripts/lib/patterns.ts`.
2. Adding the corresponding `### <name>` section to `assets/PATTERNS.md`
   with the same heading id (the test suite asserts both files match).
3. Adding a sample error string to the `SAMPLES` map in
   `scripts/diagnose.test.ts` so the per-pattern regression test passes.
4. Running `vitest run skills/debug` and confirming all tests pass.

<!-- @sync:prompt:closing-summary-debug -->
<!-- closing-summary-debug.md
     Rendered after /zama-debug finishes. Substituted via
     `renderClosingSummary('debug', vars)` from skills/_lib/closing-summary.ts
     and transcluded into SKILL.md via `@sync:prompt:closing-summary-debug`.
     Placeholder syntax: {{key}}. -->

## ✅ /zama-debug — diagnosed

### Match

- **Pattern:** `{{patternName}}`
- **Likely cause:** {{cause}}
- **Reference:** {{reference}}

### Fix

```
{{fixCommands}}
```

### Next: apply the fix above, re-run the command that failed. If the same pattern recurs after the fix, paste the new error and run `/zama-debug` again — patterns evolve as the SDK updates.

> Pattern catalog: `plugins/zama-skills/skills/debug/assets/PATTERNS.md` (10+ entries, contributions welcome).
<!-- @endsync -->
