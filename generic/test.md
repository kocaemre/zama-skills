> Auto-generated from plugins/zama-skills/skills/test/SKILL.md — do not edit manually. Run `pnpm sync` to regenerate.

# /zama-skills:test — Skeleton (Phase 1)

<!-- TODO: Phase 4 — flesh out FHE test patterns -->

FHE test pattern generator. Phase 4 implements:

- Mock test pattern (`@fhevm/hardhat-plugin` encrypted-input mock + decrypt)
- Sepolia integration test scaffold (real deploy + real encrypted input)
- `FHE.allowThis` verification (post-call decrypt confirmation)
- HCU budget warning (mock won't catch overruns; Sepolia reverts)
