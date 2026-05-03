# Deferred Items — Phase 05

## Skill bugs surfaced during 05-01 (do NOT hand-edit scaffold; fix in separate PR)

### SKILL-BUG-01: `_comment_typescript` invalid devDependency key in init root-package template

- **File**: `plugins/zama-skills/skills/init/assets/templates/root-package.json.tpl`
- **Symptom**: `pnpm install` in scaffolded examples fails with
  `ERR_PNPM_FETCH_404 GET https://registry.npmjs.org/_comment_typescript: Not Found - 404`
- **Cause**: The template uses `_comment_typescript` as a JSON "comment key" inside
  `devDependencies`. JSON has no comments, and pnpm 9 treats every key in a dep
  map as a real package name to resolve.
- **Fix (do in separate plan/PR)**: Remove the `_comment_typescript` key entirely
  and either (a) move the comment into a sibling `package.json` `// note` field
  outside `devDependencies`, or (b) drop the comment and document in the template
  file header (`.tpl` allows arbitrary preamble).
- **Impact on 05-01**: Task 2's `pnpm install` + `pnpm hardhat compile` verification
  gate cannot pass until skill is fixed. Snapshot file IS produced; scaffold IS
  committed; downstream plans (05-02 .. 05-06) blocked on this fix.
- **Surfaced**: 2026-05-03 by 05-01 dogfooding.
