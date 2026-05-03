> Auto-generated from plugins/zama-skills/skills/deploy/SKILL.md — do not edit manually. Run `pnpm sync` to regenerate.

# /zama-skills:deploy — Skeleton (Phase 1)

<!-- TODO: Phase 4 — flesh out Sepolia deploy + verify + registry workflow -->

Sepolia deploy + verify + registry registration. Phase 4 implements:

- Sepolia deploy script + Etherscan verify + ABI export
- Confidential Token Registry auto-registration (when token detected)
- Live `WebFetch` of Sepolia address list (`docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia`) — never pinned, Zama updates these
- `.env` validation with explicit error on missing vars (no half-deployed state)

`disable-model-invocation: true` is intentional — Claude must NEVER auto-deploy a contract because it "looks ready". User must explicitly invoke.
