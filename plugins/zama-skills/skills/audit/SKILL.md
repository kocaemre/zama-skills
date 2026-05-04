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
