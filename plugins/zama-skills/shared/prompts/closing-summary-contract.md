<!-- closing-summary-contract.md
     Rendered after /zama-contract finishes. Substituted via
     `renderClosingSummary('contract', vars)` from skills/_lib/closing-summary.ts
     and transcluded into SKILL.md via `@sync:prompt:closing-summary-contract`.
     Placeholder syntax: {{key}}. -->

## ✅ /zama-contract complete — `{{name}}.sol`

### What was generated

- **File written:** `{{path}}`
- **ACL grants injected:** `{{aclCount}}` (`FHE.allowThis` / `FHE.allow`)
- **Cleartext-leak patterns refused:** 12 (per `assertNoCleartextLeak`)
- **HCU header:** present (`// HCU budget: 20M/tx, 5M depth`)

### Why this is safe

Every state-write that produces an encrypted handle is paired with `FHE.allowThis(handle)`; handles exposed to users get `FHE.allow(handle, msg.sender)`. The skill **refused** to emit any `require(decrypt(...))`, `if (decrypt(x))`, or comparison against a cleartext value — the canonical replacement uses `FHE.lt` / `FHE.eq` returning an `ebool`.

> context7 was queried at scaffold time — every Solidity API used is verified against `/zama-ai/fhevm` (HIGH reputation, 1772 snippets), no hallucinated symbols.

### Next: run `/zama-test` to generate mock + Sepolia tests for `{{name}}`.
