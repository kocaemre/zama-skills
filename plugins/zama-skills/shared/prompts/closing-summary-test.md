<!-- closing-summary-test.md
     Rendered after /zama-test finishes. Substituted via
     `renderClosingSummary('test', vars)` from skills/_lib/closing-summary.ts
     and transcluded into SKILL.md via `@sync:prompt:closing-summary-test`.
     Placeholder syntax: {{key}}. -->

## ✅ /zama-test complete — tests for `{{name}}`

### What was generated

- **Mock test (unit):** `{{mockPath}}`
- **Sepolia test (integration):** `{{sepoliaPath}}`
- **ACL re-decrypt assertions:** `{{aclAssertCount}}`
- **HCU revert risk:** noted in Sepolia test header (relayer can revert if a tx exceeds the HCU budget; see comments)

### Pattern coverage

Both files use the canonical **encrypt-input → call → await decrypt → assert** flow. Mock tests use `@fhevm/hardhat-plugin` mock-utils for fast in-process decryption; Sepolia tests use the real relayer.

> context7 verified the test API surface against `/zama-ai/fhevm-hardhat-template` — pinned versions match `@fhevm/hardhat-plugin@^0.4.2`.

### Next: run `/zama-deploy` to ship `{{name}}` to Sepolia.
