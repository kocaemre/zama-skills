---
phase: 04-other-4-skills
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - plugins/zama-skills/skills/test/SKILL.md
  - plugins/zama-skills/skills/test/scripts/generate.ts
  - plugins/zama-skills/skills/test/scripts/lib/preflight.ts
  - plugins/zama-skills/skills/test/assets/templates/mock.test.ts.tpl
  - plugins/zama-skills/skills/test/assets/templates/sepolia.test.ts.tpl
  - plugins/zama-skills/skills/test/scripts/generate.test.ts
autonomous: true
requirements: [TEST-01, TEST-02, TEST-03, TEST-04]
must_haves:
  truths:
    - "Running /zama-test on an existing contract produces TWO files: <Name>.test.ts (mock) and <Name>.sepolia.test.ts (integration)"
    - "Mock test uses @fhevm/hardhat-plugin encrypted-input mock + decrypt assertion pattern"
    - "Both tests assert ACL grant succeeded (re-decrypt from same context — TEST-03)"
    - "Sepolia test gated by `if (network.name !== 'sepolia') this.skip();` and includes HCU revert risk header comment (TEST-04)"
    - "Test files target packages/contracts/test/ (matches /zama-init scaffold)"
    - "ethers v6 + typechain v6 only — refuses if v5 detected in package.json"
  artifacts:
    - path: "plugins/zama-skills/skills/test/SKILL.md"
      provides: "Skill body with AskUserQuestion (target contract) + 2-file output workflow"
      contains: "AskUserQuestion"
    - path: "plugins/zama-skills/skills/test/scripts/generate.ts"
      provides: "Reads target contract, materializes both templates, writes test files"
      exports: ["generateTests"]
    - path: "plugins/zama-skills/skills/test/assets/templates/mock.test.ts.tpl"
      provides: "Mock test template with encrypted-input mock + ACL re-decrypt assertion"
      contains: "createEncryptedInput"
    - path: "plugins/zama-skills/skills/test/assets/templates/sepolia.test.ts.tpl"
      provides: "Sepolia integration template with HCU header + relayer decrypt"
      contains: "network.name"
  key_links:
    - from: "plugins/zama-skills/skills/test/SKILL.md"
      to: "plugins/zama-skills/skills/test/scripts/generate.ts"
      via: "${CLAUDE_SKILL_DIR}/scripts/generate.ts"
      pattern: "CLAUDE_SKILL_DIR.*generate"
    - from: "generated mock.test.ts"
      to: "@fhevm/hardhat-plugin"
      via: "createInstance / createEncryptedInput"
      pattern: "createEncryptedInput"
---

<objective>
Author the `/zama-test` skill: SKILL.md body + runtime + 2 templates. Given a target contract in `packages/contracts/contracts/`, produce a mock unit test and a Sepolia integration test scaffold both with ACL verification + HCU notes.

Purpose: Implements all 4 TEST-* requirements. Ensures developers test ACL grants explicitly (the #1 fhEVM bug class) and don't get fooled by mock-only passes that revert on Sepolia for HCU.
Output: Working `/zama-test` skill that emits two compile-clean test files per contract.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/phases/04-other-4-skills/04-CONTEXT.md
@CLAUDE.md
@plugins/zama-skills/skills/test/SKILL.md
@plugins/zama-skills/shared/snippets/acl-tip.md
@plugins/zama-skills/shared/pinned-versions.json

<interfaces>
- `@fhevm/hardhat-plugin@^0.4.2` mock API:
  ```ts
  import { fhevm } from "hardhat";
  // mock plugin auto-registers `fhevm` on hre at hardhat boot
  const input = fhevm.createEncryptedInput(contractAddress, signer.address);
  input.add64(42n);
  const encrypted = await input.encrypt();
  await contract.connect(signer).setCounter(encrypted.handles[0], encrypted.inputProof);
  // decrypt assertion
  const handle = await contract.getCounter();
  const clear = await fhevm.userDecryptEuint(FhevmType.euint64, handle, signer);
  expect(clear).to.eq(42n);
  ```
- ACL re-decrypt assertion pattern (TEST-03):
  ```ts
  // After a state-write call, decrypt the handle back via the same signer.
  // If FHE.allowThis was missing or FHE.allow(handle, signer) was missing, this throws.
  const reDecrypt = await fhevm.userDecryptEuint(FhevmType.euint64, await contract.getCounter(), signer);
  expect(reDecrypt).to.eq(<expected>);
  ```
- Sepolia integration:
  ```ts
  before(function() {
    if (network.name !== "sepolia") this.skip();
  });
  ```
  Use `@zama-fhe/relayer-sdk` (devDep `0.4.1` to match plugin peer) for createInstance:
  ```ts
  import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";
  const instance = await createInstance(SepoliaConfig);
  ```
- HCU revert header (TEST-04, top of sepolia template):
  ```
  // ⚠ HCU revert risk: Sepolia enforces 20M HCU/tx + 5M depth.
  // Tests passing on mock may revert here. Profile with `pnpm gas-report`.
  ```
- ethers v6 only — `import { ethers } from "hardhat"` plus v6 syntax (no `BigNumber.from`, use BigInt literals)
- Output paths: `packages/contracts/test/<Name>.test.ts` and `packages/contracts/test/<Name>.sepolia.test.ts`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author SKILL.md body</name>
  <files>plugins/zama-skills/skills/test/SKILL.md</files>
  <action>
1. Frontmatter: `allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit]`. No `disable-model-invocation`.

2. Workflow body (preserve sync markers):
   - Pre-flight (`scripts/lib/preflight.ts`): workspace detect + `packages/contracts/contracts/` exists + ethers/typechain v6 in package.json (refuse v5).
   - AskUserQuestion: target contract name (suggest auto-detect if only one `.sol`).
   - AskUserQuestion (optional): list of state-write functions to cover (suggest auto-detect via grep of `function` declarations).
   - Generate: Bash `${CLAUDE_SKILL_DIR}/scripts/generate.ts --contract <Name>`.
   - Closing summary: 2 file paths printed; ACL re-decrypt assertions count; HCU note included reminder; "Next: run /zama-deploy to deploy to Sepolia."

3. Embed callout block: "Mock tests do NOT enforce HCU — always run the Sepolia integration test before mainnet considerations."
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'); const s=fs.readFileSync('plugins/zama-skills/skills/test/SKILL.md','utf8'); for (const m of ['AskUserQuestion','HCU','sepolia','/zama-deploy']) if (!s.toLowerCase().includes(m.toLowerCase())) { console.error('missing:',m); process.exit(1); }"</automated>
  </verify>
  <done>SKILL.md contains workflow + closing summary referencing /zama-deploy + HCU callout.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement generate.ts + 2 templates + preflight</name>
  <files>plugins/zama-skills/skills/test/scripts/generate.ts, plugins/zama-skills/skills/test/scripts/lib/preflight.ts, plugins/zama-skills/skills/test/assets/templates/mock.test.ts.tpl, plugins/zama-skills/skills/test/assets/templates/sepolia.test.ts.tpl, plugins/zama-skills/skills/test/scripts/generate.test.ts</files>
  <behavior>
    - generate({contract:"Counter"}) → writes packages/contracts/test/Counter.test.ts AND Counter.sepolia.test.ts
    - mock.test.ts.tpl output contains: `createEncryptedInput`, `userDecryptEuint`, an ACL re-decrypt assertion block
    - sepolia.test.ts.tpl output contains: `if (network.name !== "sepolia") this.skip();`, HCU header comment, `createInstance(SepoliaConfig)`
    - both files import via ethers v6 syntax (no BigNumber.from)
    - preflight detects ethers v5 → returns error "ethers v5 detected; /zama-test requires ethers v6"
    - preflight: missing target contract → "Counter.sol not found in packages/contracts/contracts/"
    - generate twice without --force → second aborts (file exists)
    - post-grep: `BigNumber\.from|ethers@\^5|fhevmjs` → 0 matches in generated files
  </behavior>
  <action>
1. Templates use placeholders for `<Name>`, `<euintType>`, `<exampleField>`, etc.

2. `generate.ts` parses contract name; greps the `.sol` file for state-write function signatures and the `euint*` types of arguments; substitutes into both templates.

3. Heuristic: read `packages/contracts/contracts/<Name>.sol`, find the first function with an `external...` parameter (encrypted input) — use that as the test target. If none found, fall back to a generic stub with a TODO comment.

4. preflight.ts:
   - Detect `packages/contracts/contracts/` and target file.
   - Read `package.json` of `packages/contracts/`. Refuse if `ethers` matches `^5` or if `@typechain/ethers-v5` is present.

5. vitest cases for all behaviors above. Use a fixture `Counter.sol` in `__fixtures__/`.
  </action>
  <verify>
    <automated>pnpm vitest run plugins/zama-skills/skills/test/scripts/generate.test.ts</automated>
  </verify>
  <done>vitest green; sample run on Counter.sol produces 2 files; both pass `pnpm tsc --noEmit` in a /zama-init workspace; mock test runs `pnpm hardhat test` green; sepolia test is skipped when not on sepolia.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Target .sol file → test generator | Untrusted on field names |
| Generated tests → Sepolia (when run) | Real funds on testnet, but throwaway |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-08 | Tampering | Skill emits ethers v5 syntax | mitigate | preflight refuses v5; post-grep `BigNumber.from` (Task 2) |
| T-04-09 | Information Disclosure | Test prints decrypted value to logs | accept | Tests by design decrypt; logs are local |
| T-04-10 | Repudiation | Mock-only test gives false confidence (HCU) | mitigate | HCU header in sepolia template + SKILL.md callout (Task 1) |
| T-04-11 | Elevation of Privilege | Skill writes outside `packages/contracts/test/` | mitigate | Hard-coded output dir; PascalCase name validation |
</threat_model>

<verification>
1. `pnpm vitest run plugins/zama-skills/skills/test/` green
2. Manual: in /zama-init'd project with a Counter.sol, run skill → 2 files appear; `pnpm hardhat test` green for mock; `pnpm hardhat test --network sepolia` runs sepolia test (or skips correctly).
</verification>

<success_criteria>
- TEST-01..04 satisfied
- Mock test uses encrypted-input mock + decrypt assertion
- Sepolia test scaffolded + gated + has HCU header
- ACL re-decrypt assertion present in both
- Zero ethers v5 syntax
</success_criteria>

<output>
Create `.planning/phases/04-other-4-skills/04-02-SUMMARY.md` with: files created, sample generated test paths, vitest summary.
</output>
