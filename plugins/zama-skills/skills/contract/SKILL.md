---
name: contract
description: Author confidential Solidity contracts using @fhevm/solidity (euint, ebool, eaddress, ACL, FHE.allowThis). Use when the user wants to write or modify FHE-aware smart contracts, integrate OpenZeppelin Confidential Contracts (ERC-7984, governance), or pick a decryption path (public/user/oracle).
when_to_use: Trigger phrases include "write fhevm contract", "confidential token", "euint", "encrypted contract", "FHE.allow", "confidential ERC20". Run when editing .sol files in a fhevm project.
allowed-tools: Read Write Edit Glob Grep Bash(npm *) Bash(npx hardhat *) WebFetch
---

# /zama-skills:contract — Skeleton (Phase 1)

<!-- TODO: Phase 4 — flesh out confidential contract authoring patterns -->

Confidential contract authoring assistant. Phase 4 implements:

- Correct `euint8/16/32/64`, `ebool`, `eaddress` typing; cleartext-leak rejection
- Mandatory `FHE.allowThis(handle)` after every state write
- OZ Confidential Contracts (ERC-7984) extend patterns
- Decryption path decision tree (public / user / oracle)
- HCU budget guidance (20M/tx, 5M depth)

All patterns sourced live from context7 (`/zama-ai/fhevm`, `/websites/openzeppelin_confidential-contracts`).
