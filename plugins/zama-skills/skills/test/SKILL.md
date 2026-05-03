---
name: test
description: Generate fhEVM tests using @fhevm/hardhat-plugin — encrypted-input mocks, decrypt assertions, Sepolia integration scaffolds. Use when the user wants to write or run tests for confidential contracts.
when_to_use: Trigger phrases include "test fhevm", "mock encrypted input", "decrypt assertion", "fhevm hardhat test", "sepolia integration test". Run when in a hardhat project with @fhevm dependencies.
allowed-tools: Read Write Edit Glob Grep Bash(npm test*) Bash(npx hardhat *) Bash(npm run *) WebFetch
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

## ACL Pattern Reminder

<!-- @sync:snippet:acl-tip -->
<!-- @endsync -->

# /zama-skills:test — Skeleton (Phase 1)

<!-- TODO: Phase 4 — flesh out FHE test patterns -->

FHE test pattern generator. Phase 4 implements:

- Mock test pattern (`@fhevm/hardhat-plugin` encrypted-input mock + decrypt)
- Sepolia integration test scaffold (real deploy + real encrypted input)
- `FHE.allowThis` verification (post-call decrypt confirmation)
- HCU budget warning (mock won't catch overruns; Sepolia reverts)
