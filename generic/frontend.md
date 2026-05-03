> Auto-generated from plugins/zama-skills/skills/frontend/SKILL.md — do not edit manually. Run `pnpm sync` to regenerate.

# /zama-skills:frontend — Skeleton (Phase 1)

<!-- TODO: Phase 4 — flesh out frontend integration patterns -->

Frontend integration assistant. Phase 4 implements:

- `@zama-fhe/relayer-sdk` `SepoliaConfig` init
- `useDecrypted(handle)` React hook with "awaiting relayer" state
- Encrypted-input component pattern
- ethers v6 + typechain wiring (rejects v5 with explicit error)

Will REFUSE to emit imports of deprecated `fhevmjs` or root `fhevm` packages (sourced from `shared/deprecated-imports.json` once Phase 2 ships it).
