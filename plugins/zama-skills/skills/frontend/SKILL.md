---
name: frontend
description: Integrate @zama-fhe/relayer-sdk into a React frontend with Wagmi/Viem or ethers v6 — encrypted input components, useDecrypted hook with relayer UX states, typechain wiring. Use when the user wants to build or extend the dApp UI.
when_to_use: Trigger phrases include "fhevm frontend", "relayer sdk", "useDecrypted", "encrypted input ui", "react fhe". Run when editing files under src/ or app/ in a fhevm project.
allowed-tools: Read Write Edit Glob Grep Bash(npm *) Bash(npx *) WebFetch
---

## Documentation Authority

<!-- @sync:shared:context7-query -->
<!-- @endsync -->

## Deprecation Guardrails

<!-- @sync:prompt:anti-deprecation -->
<!-- @endsync -->

<!-- @sync:snippet:deprecation-guard -->
<!-- @endsync -->

## Pinned Versions

<!-- @sync:snippet:versions-table -->
<!-- @endsync -->

## Decryption Paths

<!-- @sync:prompt:decryption-paths -->
<!-- @endsync -->

# /zama-skills:frontend — Skeleton (Phase 1)

<!-- TODO: Phase 4 — flesh out frontend integration patterns -->

Frontend integration assistant. Phase 4 implements:

- `@zama-fhe/relayer-sdk` `SepoliaConfig` init
- `useDecrypted(handle)` React hook with "awaiting relayer" state
- Encrypted-input component pattern
- ethers v6 + typechain wiring (rejects v5 with explicit error)

Will REFUSE to emit imports of deprecated `fhevmjs` or root `fhevm` packages (sourced from `shared/deprecated-imports.json` once Phase 2 ships it).
