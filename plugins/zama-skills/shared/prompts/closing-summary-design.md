<!-- closing-summary-design.md
     Rendered after /zama-design finishes. Substituted via
     `renderClosingSummary('design', vars)` from skills/_lib/closing-summary.ts
     and transcluded into SKILL.md via `@sync:prompt:closing-summary-design`.
     Placeholder syntax: {{key}}. -->

## ✅ /zama-design complete — `{{useCase}}` blueprint

### What was generated

- **DESIGN.md:** `{{designPath}}` — contract architecture, state schema, ACL strategy per actor, decryption path per data type
- **UI-WIREFRAME.md:** `{{wireframePath}}` — component tree, user flows, 4-state UX hooks per screen
- **Reference patterns:** queried via context7 against `/zama-ai/fhevm` + `/websites/openzeppelin_confidential-contracts`

### Why this is grounded

The blueprint cites only OpenZeppelin Confidential Contracts primitives that exist in `@openzeppelin/confidential-contracts@^0.4.x`, ACL patterns documented in `@fhevm/solidity@^0.11.x`, and SDK calls present in `@zama-fhe/relayer-sdk@^0.4.x`. Use-case-specific decisions (e.g. ERC7984 vs custom euint storage) are justified inline.

### Next: run `/zama-init` in an empty dir, then `/zama-contract` referencing `DESIGN.md` for state schema + ACL plan.
