> Auto-generated from plugins/zama-skills/skills/contract/SKILL.md — do not edit manually. Run `pnpm sync` to regenerate.

# /zama-skills:contract — Skeleton (Phase 1)

<!-- TODO: Phase 4 — flesh out confidential contract authoring patterns -->

Confidential contract authoring assistant. Phase 4 implements:

- Correct `euint8/16/32/64`, `ebool`, `eaddress` typing; cleartext-leak rejection
- Mandatory `FHE.allowThis(handle)` after every state write
- OZ Confidential Contracts (ERC-7984) extend patterns
- Decryption path decision tree (public / user / oracle)
- HCU budget guidance (20M/tx, 5M depth)

All patterns sourced live from context7 (`/zama-ai/fhevm`, `/websites/openzeppelin_confidential-contracts`).
