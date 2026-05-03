---
name: deploy
description: Deploy compiled fhEVM contracts to Sepolia testnet, verify on Etherscan, and (if applicable) auto-register with the Confidential Token Registry. Use ONLY when the user explicitly asks to deploy.
when_to_use: User has compiled contracts and explicitly types "/zama-skills:deploy" or asks to deploy to Sepolia. Never auto-invoke — destructive on-chain action.
disable-model-invocation: true
allowed-tools: Read Write Bash(npx hardhat *) Bash(npm run *) Bash(node *) WebFetch
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

## Sepolia Setup

<!-- @sync:snippet:sepolia-faucet -->
<!-- @endsync -->

## Closing Summary

<!-- @sync:prompt:closing-summary -->
<!-- @endsync -->

# /zama-skills:deploy — Skeleton (Phase 1)

<!-- TODO: Phase 4 — flesh out Sepolia deploy + verify + registry workflow -->

Sepolia deploy + verify + registry registration. Phase 4 implements:

- Sepolia deploy script + Etherscan verify + ABI export
- Confidential Token Registry auto-registration (when token detected)
- Live `WebFetch` of Sepolia address list (`docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia`) — never pinned, Zama updates these
- `.env` validation with explicit error on missing vars (no half-deployed state)

`disable-model-invocation: true` is intentional — Claude must NEVER auto-deploy a contract because it "looks ready". User must explicitly invoke.
