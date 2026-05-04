---
name: debug
description: Diagnose fhEVM / Zama Protocol errors from a pasted revert message, vitest failure, hardhat trace, or runtime exception. Matches the input against a curated catalog of 10 known patterns (ACL grants, deprecated fhevmjs/fhevm imports, HCU exhaustion, relayer SSR/indexedDB, Etherscan v1, relayer 502, wagmi ABI drift, ZamaConfig path, /bundle vs /web entry) and returns a likely root cause, concrete fix command(s), and an authoritative reference link.
when_to_use: Trigger when the user pastes any of the strings "ACL: not allowed", "Cannot read properties of undefined (reading 'initSDK')", "Module not found 'fhevmjs'", "Module not found 'fhevm'", "HCU exceeded", "BAILOUT_TO_CLIENT_SIDE_RENDERING", "indexedDB is not defined", "Etherscan: V1 endpoint deprecated", "relayer 502", "useReadContract undefined", or "ZamaEthereumConfig not found". Also trigger when they say "debug fhevm error", "diagnose fhe", "/zama-debug", "what does this fhevm error mean", or paste a hardhat / vitest / next stack trace mentioning fhe / zama / euint / relayer.
allowed-tools: AskUserQuestion Read Bash(node *) Bash(npx *) Bash(tsx *) Grep
---

## Documentation Authority

<!-- @sync:shared:context7-query -->
<!-- This block is regenerated from shared/context7-query.md by `pnpm sync`.
     Edit shared/context7-query.md, not this skill. -->
Before fabricating a diagnosis from training memory, query context7 for
the topic implied by the matched pattern (e.g., `topic: "acl"` for
`acl-not-allowed`, `topic: "decryption"` for relayer issues). The
catalog in `assets/PATTERNS.md` is authoritative for *known* patterns;
anything else MUST be verified live.
<!-- @endsync -->

## Deprecation Guardrails

<!-- @sync:prompt:anti-deprecation -->
<!-- Regenerated from shared/prompts/anti-deprecation.md.
     Two patterns in this skill (`deprecated-fhevmjs`, `deprecated-fhevm-root`)
     reference the canonical replacements declared in
     `shared/deprecated-imports.json`. Never suggest a "last known good"
     pin or a workaround for either deprecated package — refuse and
     point at the replacement. -->
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
