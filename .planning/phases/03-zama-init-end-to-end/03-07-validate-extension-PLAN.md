---
phase: 03-zama-init-end-to-end
plan: 07
type: execute
wave: 4
depends_on: [03-01, 03-02, 03-03, 03-04, 03-05]
files_modified:
  - scripts/validate.ts
  - scripts/validate.test.ts
autonomous: true
requirements: [INIT-02]
must_haves:
  truths:
    - "validate.ts gains an asset-audit step covering plugins/zama-skills/skills/init/assets/**"
    - "Audit fails if any .tpl or .sol contains fhevmjs / root-fhevm import (excluding documented comment lines)"
    - "Audit fails if a template references an @pin:<key> not present in pinned-versions.json"
    - "Audit fails if any required template/seed file is missing (whitelist enforced)"
    - "pnpm validate (existing CI entrypoint) runs the audit; no new GitHub Actions job needed"
  artifacts:
    - path: "scripts/validate.ts"
      provides: "Extended validation pipeline with asset audit"
      contains: "auditInitAssets"
    - path: "scripts/validate.test.ts"
      provides: "Coverage for the new audit"
      contains: "auditInitAssets"
  key_links:
    - from: "validate.ts"
      to: "plugins/zama-skills/skills/init/assets/**"
      via: "fs walk + regex audit"
      pattern: "skills/init/assets"
    - from: "validate.ts"
      to: "scripts/lib/versions.ts"
      via: "loadVersions + listAllPackages for pin key validation"
      pattern: "listAllPackages"
---

<objective>
Extend the existing `pnpm validate` pipeline (Phase 1 + Phase 2) with an audit step that locks down `/zama-init` assets. Catches drift early — before assets ship in a published plugin.

Purpose: Defense-in-depth. The runtime scaffold has its own deprecation grep (03-04 step 9), but that runs on the user's machine. This audit runs in our CI, blocks merges, and catches @pin keys that don't exist in pinned-versions.json (otherwise scaffold throws at user-runtime — too late).
Output: Two file edits, both extending existing files (no new CI job).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-zama-init-end-to-end/ORCHESTRATION.md
@scripts/validate.ts
@scripts/validate.test.ts
@scripts/lib/versions.ts

<interfaces>
- Existing `validate.ts` has a `runValidate({ check?: boolean })` entry. We add a new function `auditInitAssets(dirs): { ok: boolean; errors: string[] }` and call it from runValidate.
- @pin regex: `/<!--\s*@pin:([^\s>]+)\s*-->/g` (same as build.ts / pin-resolver.ts).
- Special pin keys allowed even if not in `packages`: `solc` (from `compiler.solc`), `@zama-fhe/relayer-sdk-dev` (alias).
- Required file whitelist (must exist):
  - `plugins/zama-skills/skills/init/assets/templates/{pnpm-workspace.yaml.tpl,root-package.json.tpl,root-readme.md.tpl,.env.example.tpl,.gitignore.tpl}`
  - `plugins/zama-skills/skills/init/assets/templates/packages/contracts/{package.json.tpl,hardhat.config.ts.tpl,tsconfig.json.tpl}`
  - `plugins/zama-skills/skills/init/assets/templates/packages/frontend/{package.json.tpl,vite.config.ts.tpl,index.html.tpl,src/main.tsx.tpl,src/App.tsx.tpl}`
  - `plugins/zama-skills/skills/init/assets/seeds/confidential-token/Token.sol`
  - `plugins/zama-skills/skills/init/assets/seeds/voting/Poll.sol`
  - `plugins/zama-skills/skills/init/assets/seeds/auction/SealedBidAuction.sol`
  - `plugins/zama-skills/skills/init/assets/seeds/custom/Skeleton.sol`
- Deprecation grep: same comment-line allowlist as scaffold.ts (lines starting `//`, `*`, or `#` after lstrip).
- Error prefix per ORCHESTRATION.md: `Asset audit failed:` for new errors (drift errors keep their existing message).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement auditInitAssets + wire into runValidate</name>
  <files>scripts/validate.ts</files>
  <action>
- Add `auditInitAssets(rootDir: string): { ok: boolean; errors: string[] }`:
  1. **Required-files check**: iterate the whitelist (above); if any missing → push `Asset audit failed: required asset missing: <path>`.
  2. **Pin-key check**: for each .tpl file, scan with the @pin regex. Build a set of all keys referenced. Cross-check against `loadVersions().packages` keys + special keys (`solc`, alias). For any unknown key → `Asset audit failed: unknown @pin key '<key>' in <file> — add to pinned-versions.json or remove`.
  3. **Deprecation grep**: walk `assets/templates/**` and `assets/seeds/**` (but skip `assets/seeds/custom/Skeleton.sol`'s deprecation-warning comment block — handled by comment-line allowlist). For any non-comment line containing `fhevmjs` or `"fhevm":` → `Asset audit failed: deprecated identifier '<token>' in <file>:<line>`.
- Call `auditInitAssets` from `runValidate(...)` after the existing checks. Aggregate errors with the existing error list. Audit failures must cause `pnpm validate` to exit non-zero.
- Print results human-readably (existing console style with picocolors).
- Performance: O(files) single-pass; fine for a few dozen files.
  </action>
  <verify>
    <automated>
      grep -q "auditInitAssets" scripts/validate.ts && \
      grep -q "Asset audit failed" scripts/validate.ts && \
      grep -q "@pin" scripts/validate.ts && \
      pnpm exec tsc --noEmit --project tsconfig.json && \
      pnpm validate
    </automated>
  </verify>
  <done>auditInitAssets exists, wired into runValidate, full pnpm validate pipeline still green against the materialized assets from 03-02..05.</done>
</task>

<task type="auto">
  <name>Task 2: Extend validate.test.ts with audit coverage</name>
  <files>scripts/validate.test.ts</files>
  <action>
Add a new `describe("auditInitAssets")` block:
- **happy path**: against the real repo dir → `ok: true, errors: []`.
- **missing required file**: in a tmp fixture dir mirroring the structure but missing `Token.sol` → error contains "required asset missing".
- **unknown @pin key**: tmp fixture with a .tpl containing `<!-- @pin:not-a-real-pkg -->` → error contains "unknown @pin key 'not-a-real-pkg'".
- **deprecation hit**: tmp fixture with a .sol containing `import "fhevmjs";` (non-comment) → error contains "deprecated identifier".
- **comment-line allow**: tmp fixture with `// fhevmjs note` → no error (comment lines pass).

Use vitest's tmpdir helpers; clean up in afterEach.
  </action>
  <verify>
    <automated>
      grep -q "auditInitAssets" scripts/validate.test.ts && \
      pnpm exec vitest run scripts/validate.test.ts
    </automated>
  </verify>
  <done>5 new test cases all green; coverage maintained or improved.</done>
</task>

</tasks>

<verification>
- `pnpm validate` exits 0 against the merged repo (all assets present, all @pin keys known, no deprecation hits).
- `pnpm exec vitest run scripts/validate.test.ts` reports all green including new audit cases.
- Removing any whitelisted file or adding a `<!-- @pin:bogus -->` to a template makes `pnpm validate` exit 1.
</verification>

<success_criteria>
- INIT-02 (deprecation-free, pinned versions) — enforced at CI time, not just at user-runtime.
- No new GitHub Actions job; reuses existing `pnpm validate` from Phase 1.
- All Phase 2 drift checks remain green (additive change only).
</success_criteria>

<output>
After completion, create `.planning/phases/03-zama-init-end-to-end/03-07-SUMMARY.md` documenting: the new audit step, the whitelist of required files, the comment-line allowlist semantics, and the canonical error prefix.
</output>
