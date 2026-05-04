---
name: audit
description: Run an FHE-aware code review on a Solidity + TypeScript codebase using @fhevm/solidity. Detects four high-impact issue classes — missing ACL grants (FHE.allowThis / FHE.allow), cleartext leaks via require/event/emit on decrypted values, HCU-explosion functions (>12 warning, >20 error FHE ops in one tx), and imports of officially deprecated packages (fhevm root, fhevmjs). Produces AUDIT-REPORT.md with severity classification.
when_to_use: Trigger phrases include "audit fhevm contract", "review fhe code", "check ACL grants", "find cleartext leaks", "HCU budget", "deprecated fhevmjs". Run before deploying confidential contracts to Sepolia, after major refactors of euint logic, or when migrating off deprecated fhevm/fhevmjs.
allowed-tools: Read Glob Grep Bash(tsx *) Bash(node *) Bash(npm *) Bash(pnpm *)
---

## Purpose

`/zama-audit` performs a fast, FHE-aware static review of a project that uses `@fhevm/solidity`, `@fhevm/hardhat-plugin`, and `@zama-fhe/relayer-sdk`. It is **not** a full Solidity auditor — it focuses on the four mistake classes that are unique to confidential contracts and that conventional linters (solhint, slither) do not catch.

## Usage

```bash
# audit current directory
tsx ${CLAUDE_SKILL_DIR}/scripts/audit.ts

# audit a specific path
tsx ${CLAUDE_SKILL_DIR}/scripts/audit.ts packages/contracts/contracts

# write report to a custom file
tsx ${CLAUDE_SKILL_DIR}/scripts/audit.ts ./contracts --out my-audit.md
```

The report is written to `AUDIT-REPORT.md` at the audit root. Exit codes:

| Exit | Meaning |
| --- | --- |
| 0 | No findings |
| 1 | At least one WARNING |
| 2 | At least one CRITICAL |

## What it checks

### 1. ACL gaps — CRITICAL
For every Solidity file, the checker scans for two patterns:
- A storage write to an `euint*` / `ebool` / `eaddress` slot **not** followed (within 5 lines) by `FHE.allowThis(<lhs>);`. Without this grant the contract loses access to the ciphertext on the next call.
- A function whose `returns (...)` list contains an encrypted type, where the `return <expr>;` is **not** preceded by `FHE.allow(<expr>, msg.sender);`. Without this grant the caller cannot decrypt.

### 2. Cleartext leaks — CRITICAL / WARNING
- `require(<cond>, "<msg>")` where `<cond>` references a value previously assigned from `FHE.decrypt(...)` — or `<msg>` mentions `balance`/`amount`/`%d`. Reverts based on plaintext leak the value via failure logs.
- `emit Event(..., x, ...)` where `x` is, or contains, a decrypted value. Events are public.
- "Decrypt-then-emit" pattern within 8 lines of the same function — heuristic flag for code that shouldn't decrypt on-chain at all.

### 3. HCU explosions — WARNING / CRITICAL
Counts `FHE.<op>(` calls per function (`add`, `sub`, `mul`, `lt`, `gt`, `le`, `ge`, `eq`, `ne`, `select`, `cmux`, `and`, `or`, `xor`, `not`).

| Count | Severity |
| --- | --- |
| >12  | WARNING (likely close to per-tx HCU budget) |
| >20  | CRITICAL (very likely exceeds budget — will revert at runtime) |

Reference the live HCU table at <https://docs.zama.org/protocol/solidity-guides/development-guide/hcu>. Suggested fixes: split into multiple txs, cache intermediates with `FHE.allowThis`, or precompute off-chain.

### 4. Deprecated imports — CRITICAL
Hard-error on:
- Solidity `import "fhevm/...";` — root `fhevm` package was deprecated 2025-07-10 (use `@fhevm/solidity`).
- TypeScript / JavaScript `from "fhevmjs"` or `require("fhevmjs")` — deprecated 2025-07-10 (use `@zama-fhe/relayer-sdk`).
- TypeScript / JavaScript `from "fhevm"` (root, NOT `@fhevm/solidity`).

The replacement command is included in the report's suggested fix.

## Heuristics & limitations

- Regex-based, not AST-based. Designed for speed and zero install dependencies. False positives on unusual code (multi-line returns, string-template requires) are possible but rare in idiomatic fhEVM contracts.
- Only files matching `*.sol`, `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.mjs`, `*.cjs` are scanned. `node_modules`, `dist`, `build`, `out`, `artifacts`, `cache`, `coverage`, `typechain-types`, `__fixtures__` are skipped.
- Not a substitute for `slither`, `solhint`, or a manual security review — it complements them by covering FHE-specific footguns.


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

When the user asks "is this fixed correctly?", or to add a check for a new pattern, query context7 for the latest Zama guidance:

1. `mcp__context7__resolve-library-id` with `libraryName: "fhevm"` → `/zama-ai/fhevm`.
2. `mcp__context7__get-library-docs` with `topic: "acl"`, `topic: "decryption"`, or `topic: "hcu"` for the latest semantics.
3. The HCU thresholds in the source (`12`, `20`) are heuristics; check the live HCU table linked above for the authoritative per-op cost in your gas regime.

## Tests

Run the suite with:

```bash
cd <repo-root>
npm test -- audit
```

Vitest covers all four checkers with positive (bug) and negative (clean) fixtures under `${CLAUDE_SKILL_DIR}/scripts/__fixtures__/`.

<!-- @sync:prompt:closing-summary-audit -->
<!-- closing-summary-audit.md
     Rendered after /zama-audit finishes. Substituted via
     `renderClosingSummary('audit', vars)` from skills/_lib/closing-summary.ts
     and transcluded into SKILL.md via `@sync:prompt:closing-summary-audit`.
     Placeholder syntax: {{key}}. -->

## ✅ /zama-audit complete — `{{scope}}`

### Findings

- **Critical:** `{{criticalCount}}` (ACL gap / cleartext leak / deprecated import)
- **Warning:** `{{warningCount}}` (HCU >12 ops, deprecated comment-only)
- **Info:** `{{infoCount}}`
- **Report:** `{{reportPath}}` (severity-classified, per-file, with file:line)

### Categories scanned

- ACL: `FHE.allowThis` / `FHE.allow(value, msg.sender)` reachability per `euint*` write
- Cleartext leak: revert messages / events / logs that surface decrypted values
- HCU explosion: FHE op count per function (>12 warn, >20 critical) — see Zama HCU table
- Deprecation: `fhevmjs`, `fhevm` root imports per `shared/deprecated-imports.json`

### Next:
- If findings found: run `/zama-debug` for fix recipes, or re-run `/zama-contract --regenerate` after editing.
- If clean (exit 0): you're ready to `/zama-deploy`.
<!-- @endsync -->
