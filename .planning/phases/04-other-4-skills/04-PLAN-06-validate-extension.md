---
phase: 04-other-4-skills
plan: 06
type: execute
wave: 2
depends_on: [04-01, 04-02, 04-03, 04-04, 04-05]
files_modified:
  - scripts/validate.ts
  - scripts/validate.test.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "scripts/validate.ts gains audit checks for the 4 Phase 4 skill bundles"
    - "Audit verifies SKILL.md frontmatter (allowed-tools present; /zama-deploy has disable-model-invocation: true)"
    - "Audit verifies required asset files exist for each skill (templates + scripts/generate.ts + scripts/lib/*)"
    - "Audit greps each skill bundle for deprecated imports (fhevmjs, fhevm root, ethers ^5, hardhat ^3) — fails on any hit"
    - "Audit verifies @sync:prompt:closing-summary-<skill> markers present in each SKILL.md"
    - "CI runs `pnpm validate` and fails if any audit check fails"
  artifacts:
    - path: "scripts/validate.ts"
      provides: "Extended with auditPhase4Skills() function"
      contains: "auditPhase4Skills"
  key_links:
    - from: "scripts/validate.ts (auditPhase4Skills)"
      to: "plugins/zama-skills/skills/{contract,test,deploy,frontend}/"
      via: "fs.readdir + readFile per skill bundle"
      pattern: "auditPhase4Skills"
---

<objective>
Extend `scripts/validate.ts` with `auditPhase4Skills()` to audit all 4 Phase 4 skill bundles: frontmatter compliance, required-files manifest, deprecation grep, sync-marker presence. Fail CI on any miss.

Purpose: Prevent regression — if a future change drops a template, removes `disable-model-invocation` from /zama-deploy, or sneaks in a deprecated import, CI catches it.
Output: validate.ts gains one new audit fn + test cases; CI green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/phases/04-other-4-skills/04-CONTEXT.md
@scripts/validate.ts
@scripts/validate.test.ts
@plugins/zama-skills/shared/deprecated-imports.json

<interfaces>
- Per-skill required-files manifest:
  ```ts
  const PHASE4_MANIFEST = {
    contract: {
      skillMd: 'plugins/zama-skills/skills/contract/SKILL.md',
      scripts: ['scripts/generate.ts', 'scripts/lib/acl-injector.ts', 'scripts/lib/cleartext-guard.ts', 'scripts/lib/preflight.ts'],
      templates: ['assets/templates/contract.sol.tpl', 'assets/templates/erc7984.sol.tpl', 'assets/templates/votes.sol.tpl'],
      requiresDisableModelInvocation: false,
      syncMarkers: ['@sync:prompt:closing-summary-contract'],
    },
    test: {
      skillMd: 'plugins/zama-skills/skills/test/SKILL.md',
      scripts: ['scripts/generate.ts', 'scripts/lib/preflight.ts'],
      templates: ['assets/templates/mock.test.ts.tpl', 'assets/templates/sepolia.test.ts.tpl'],
      requiresDisableModelInvocation: false,
      syncMarkers: ['@sync:prompt:closing-summary-test'],
    },
    deploy: {
      skillMd: 'plugins/zama-skills/skills/deploy/SKILL.md',
      scripts: ['scripts/deploy.ts', 'scripts/lib/env-validate.ts', 'scripts/lib/sepolia-addresses.ts', 'scripts/lib/abi-export.ts', 'scripts/lib/preflight.ts'],
      templates: ['assets/templates/deploy.ts.tpl', 'assets/templates/register-token.ts.tpl'],
      requiresDisableModelInvocation: true,
      syncMarkers: ['@sync:prompt:closing-summary-deploy'],
    },
    frontend: {
      skillMd: 'plugins/zama-skills/skills/frontend/SKILL.md',
      scripts: ['scripts/generate.ts', 'scripts/lib/preflight.ts'],
      templates: ['assets/templates/fhe.ts.tpl', 'assets/templates/useDecrypted.ts.tpl', 'assets/templates/EncryptedInput.tsx.tpl', 'assets/templates/fhe-wagmi.ts.tpl'],
      requiresDisableModelInvocation: false,
      syncMarkers: ['@sync:prompt:closing-summary-frontend'],
    },
  };
  ```
- Deprecation banlist source: `plugins/zama-skills/shared/deprecated-imports.json` (already exists from Phase 2). Augment grep to scan templates + scripts of Phase 4 skills.
- Pinned-Sepolia-address grep (DEPLOY-03 invariant): `\b0x[0-9a-fA-F]{40}\b` in `plugins/zama-skills/skills/deploy/{SKILL.md,scripts/**,assets/**}` → REFUSE (must be live-fetched, not pinned). Allow only inside test fixtures (paths containing `__fixtures__` or `.test.`).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add auditPhase4Skills() + tests</name>
  <files>scripts/validate.ts, scripts/validate.test.ts</files>
  <behavior>
    - auditPhase4Skills() on a complete repo (after Plans 01-05) → returns { ok: true, errors: [] }
    - missing assets/templates/contract.sol.tpl → { ok:false, errors:['contract: missing template contract.sol.tpl'] }
    - /zama-deploy SKILL.md without `disable-model-invocation: true` → { ok:false, errors:['deploy: requires disable-model-invocation: true'] }
    - inserting `import 'fhevmjs'` into a frontend template → error with exact path
    - inserting a hex address into deploy/SKILL.md (outside test fixture) → error
    - missing @sync:prompt:closing-summary-deploy marker in deploy/SKILL.md → error
    - extension is wired into the existing `runValidate()` entry point so `pnpm validate` invokes it
  </behavior>
  <action>
1. In `scripts/validate.ts`:
   - Add `auditPhase4Skills(): { ok: boolean; errors: string[] }` per <interfaces>.
   - For each skill in PHASE4_MANIFEST:
     - Verify SKILL.md exists, parse YAML frontmatter, check `allowed-tools` present, check `disable-model-invocation: true` iff required.
     - Verify each script and template path exists.
     - Verify each sync marker substring present in SKILL.md.
     - Read deprecated-imports.json banlist; grep all script + template files; collect any matches.
   - For deploy skill: scan SKILL.md + scripts + templates (excluding test/fixture paths) for `\b0x[0-9a-fA-F]{40}\b`; reject any match.
   - Append errors with the exact file path that failed.
   - Wire into `runValidate()` so existing `pnpm validate` entry runs auditPhase4Skills.

2. In `scripts/validate.test.ts`:
   - Add a `describe('auditPhase4Skills', ...)` block with all behaviors above.
   - Use a temp-dir helper to set up minimal/broken fixtures.
   - Use the existing fixture/util patterns already in validate.test.ts (do not invent a new harness).
  </action>
  <verify>
    <automated>pnpm vitest run scripts/validate.test.ts -t auditPhase4Skills && pnpm validate</automated>
  </verify>
  <done>vitest green for all behaviors; `pnpm validate` exits 0 on the real repo after Plans 01-05; CI workflow runs auditPhase4Skills via the existing pnpm validate entry.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CI → repo source | Trusted; this is the audit harness |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-27 | Tampering | Future PR removes disable-model-invocation from /zama-deploy | mitigate | auditPhase4Skills frontmatter check fails CI (Task 1) |
| T-04-28 | Tampering | Future PR pins a Sepolia address into deploy skill source | mitigate | Hex-address grep on deploy bundle (Task 1) |
| T-04-29 | Tampering | Future PR re-introduces fhevmjs | mitigate | deprecation grep against shared/deprecated-imports.json (Task 1) |
| T-04-30 | Tampering | Future PR drops a closing-summary @sync marker | mitigate | sync-marker substring check (Task 1) |
</threat_model>

<verification>
1. `pnpm vitest run scripts/validate.test.ts -t auditPhase4Skills` green
2. `pnpm validate` on the full repo exits 0
3. Negative smoke: temporarily remove a template → `pnpm validate` exits non-zero with named error
</verification>

<success_criteria>
- auditPhase4Skills covers all 4 skills × 4 invariants (frontmatter, files, sync markers, deprecation grep)
- /zama-deploy hex-address ban verified
- vitest + pnpm validate green
</success_criteria>

<output>
Create `.planning/phases/04-other-4-skills/04-06-SUMMARY.md` with: audit cases added, errors caught on negative fixtures, validate run summary.
</output>
