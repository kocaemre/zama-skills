---
name: init
description: Scaffold a new confidential dApp from the official fhevm-react-template, customized for the user's chosen use-case (token, voting, auction, custom). Use when the user wants to bootstrap a new Zama Protocol / fhEVM project from scratch.
when_to_use: Trigger phrases include "init zama project", "new fhevm dapp", "scaffold confidential token", "start zama", "bootstrap confidential dapp". Run when working in an empty or near-empty directory.
context: fork
allowed-tools: Bash(git *) Bash(npm *) Bash(npx *) Bash(mkdir *) Bash(cp *) Read Write Edit Glob Grep WebFetch
---

# /zama-skills:init — Skeleton (Phase 1)

<!-- TODO: Phase 3 — flesh out scaffolding workflow -->

Scaffold the official `fhevm-react-template` and customize for the user's confidential dApp use-case. Phase 3 fleshes out:

- Use-case branching (token / voting / auction / custom)
- Pinned-version injection from `shared/pinned-versions.json`
- `.env.example` generation (Sepolia RPC, mnemonic, Etherscan, relayer URL, registry)
- MetaMask Sepolia deep-link
- Closing summary

Resources will be referenced via `${CLAUDE_SKILL_DIR}/` once Phase 3 populates them.
