---
phase: 02-shared-infrastructure
plan: 05
type: execute
wave: 4
depends_on: [02-04-skill-markers]
files_modified:
  - scripts/validate.ts
  - package.json
  - .github/workflows/ci.yml
autonomous: true
requirements: [SHARED-01, SHARED-04]
must_haves:
  truths:
    - "`pnpm sync` and `pnpm sync:check` are valid npm scripts"
    - "`scripts/validate.ts` invokes runSync({ check: true }) as part of the validate pipeline"
    - "CI fails clearly with `Drift detected. Run \\`pnpm sync\\` and commit the result.` when SKILL.md or examples drift"
    - "All Phase 2 wave-1..wave-3 outputs remain green under the extended validate"
  artifacts:
    - path: "scripts/validate.ts"
      provides: "Phase-1 manifest validator + Phase-2 sync drift check"
      contains: "runSyncCheck"
    - path: "package.json"
      provides: "Extended npm scripts: sync, sync:check"
      contains: "\"sync\""
  key_links:
    - from: "scripts/validate.ts"
      to: "scripts/build.ts"
      via: "import { runSync } and call with check:true"
      pattern: "runSync"
    - from: "package.json scripts.sync"
      to: "scripts/build.ts"
      via: "tsx scripts/build.ts"
      pattern: "tsx scripts/build"
---

<objective>
Wire the sync engine into the existing Phase-1 validate pipeline and expose npm scripts so maintainers and CI can both run it. Verify the existing CI workflow doesn't need a structural change (validate.ts is the entrypoint already).

Purpose: This is the integration step that makes the build engine actually CI-enforced. Without this, drift could ship.

Output: Extended validate.ts, updated package.json scripts, optional CI workflow tweak (likely just an informational comment).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@scripts/validate.ts
@scripts/build.ts
@package.json
@.github/workflows/ci.yml

<interfaces>
<!-- From plan 02-03 -->
From `scripts/build.ts`:
```typescript
export async function runSync(opts: { check: boolean }): Promise<{ changed: string[]; errors: string[] }>;
```

<!-- Existing scripts (Phase 1) -->
- `pnpm validate` runs `tsx scripts/validate.ts`
- `pnpm test` runs `vitest run --passWithNoTests`
- `pnpm typecheck` runs `tsc --noEmit`
- CI runs `pnpm install --frozen-lockfile && pnpm validate && pnpm test`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend scripts/validate.ts with runSyncCheck() and add npm scripts</name>
  <files>scripts/validate.ts, package.json</files>
  <action>
    **Edit `scripts/validate.ts`:**
    - Import `runSync` from `./build.js` (or `./build.ts` per current import style; check existing imports in validate.ts and match).
    - Add an async function `runSyncCheck()` that calls `runSync({ check: true })` and returns its result.
    - In the existing main flow (after manifest validation), call `runSyncCheck()`. If `errors.length > 0`, print each error in red, then print the canonical message: `Drift detected. Run \`pnpm sync\` and commit the result.` and `process.exit(1)`.
    - Add a `--skip-sync` CLI flag that bypasses the drift check (for local manifest-only validation if a maintainer needs it). Default behavior: drift check runs.
    - Preserve existing manifest validation behavior — no regressions.

    **Edit `package.json` scripts:**
    Add three new entries (do NOT remove or rename existing ones):
    ```json
    {
      "scripts": {
        "validate": "tsx scripts/validate.ts",
        "sync": "tsx scripts/build.ts",
        "sync:check": "tsx scripts/build.ts --check",
        "test": "vitest run --passWithNoTests",
        "typecheck": "tsc --noEmit",
        "cli": "tsx src/cli/index.ts"
      }
    }
    ```

    Run `pnpm sync:check` after editing — must exit 0 (Phase 2 plans 01-04 left the tree in a synced state). If it fails, surface the diff and stop.
  </action>
  <verify>
    <automated>pnpm sync:check && pnpm validate && pnpm test && grep -q '"sync"' package.json && grep -q '"sync:check"' package.json && grep -q "runSyncCheck\|runSync" scripts/validate.ts && grep -q "Drift detected" scripts/validate.ts && echo OK</automated>
  </verify>
  <done>
    `pnpm validate` runs both manifest validation AND drift check. `pnpm sync` and `pnpm sync:check` work as documented. Existing Phase-1 vitest suite still green. validate.ts contains the canonical drift-detected error message verbatim.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add unit test for end-to-end drift detection and confirm CI workflow</name>
  <files>scripts/validate.test.ts, .github/workflows/ci.yml</files>
  <behavior>
    - When all SKILL.md and examples are in sync, runSync({ check: true }) returns errors.length === 0
    - When a single SKILL.md is mutated to drift (e.g., body between markers manually changed), runSync({ check: true }) returns errors.length >= 1 with a message naming the drifted file
    - validate.ts entrypoint exits 1 on drift (test by spawning subprocess via node:child_process and asserting exit code)
  </behavior>
  <action>
    **Create `scripts/validate.test.ts`** using vitest:
    - Test 1 (in-sync): call `runSync({ check: true })` directly; assert errors empty.
    - Test 2 (drifted SKILL.md): use a temp directory + fs-extra to copy `plugins/zama-skills/` into temp, mutate one SKILL.md's marker body, override `process.cwd()` for the test (or expose a `cwd` option on `runSync` if not already present — if needed, add it to build.ts). Assert errors length > 0 and a clear filename appears in the error.
    - Test 3 (subprocess exit code): spawn `tsx scripts/validate.ts` as a child process in a fixture dir with synthetic drift; assert exit code 1 and stderr contains "Drift detected".

    If `runSync` doesn't accept a `cwd` parameter, the simplest fix is to use `process.chdir()` inside the test wrapped in try/finally. Document this in the test's comments. (Avoid making invasive build.ts changes here; just use `process.chdir`.)

    **Inspect `.github/workflows/ci.yml`** — it currently runs `pnpm validate && pnpm test`. Since `pnpm validate` now invokes the drift check, no workflow change is structurally required. However:
    - Add a comment near the validate step: `# pnpm validate now also runs sync drift check (Phase 2 SHARED-04). Failures here mean run \`pnpm sync\` locally and commit.`
    - Confirm the workflow uses `pnpm install --frozen-lockfile` (required so deps match lockfile in CI).

    If the workflow does NOT yet exist (Phase 1 may have one or may not), do not create one in this plan — just note the absence in the plan's SUMMARY and surface it as a pre-Phase-6 gap. (Phase 1 was reported complete with CI in PROJECT context — assume it exists.)
  </action>
  <verify>
    <automated>pnpm vitest run scripts/validate.test.ts && (test -f .github/workflows/ci.yml && grep -qi "validate" .github/workflows/ci.yml || echo "WARN: ci.yml missing or does not reference validate — not blocking") && echo OK</automated>
  </verify>
  <done>
    Three vitest tests pass (in-sync, drift-detected, subprocess exit-1). CI workflow either references validate (which now includes drift check) or is documented as a follow-up. `pnpm validate` is the single CI entrypoint covering manifest + sync drift.
  </done>
</task>

</tasks>

<verification>
1. `pnpm validate` exits 0 with current tree.
2. Manually corrupt one SKILL.md marker body, re-run `pnpm validate` — exits 1 with `Drift detected. Run \`pnpm sync\` and commit the result.` Then run `pnpm sync` to restore, exits 0 again.
3. `pnpm vitest run` (full suite) green including new validate.test.ts.
4. `pnpm typecheck` zero errors.
5. `pnpm sync:check` exits 0; `pnpm sync` exits 0 with "no changes" message on second consecutive run.
</verification>

<success_criteria>
- npm scripts `sync` and `sync:check` work and are documented in package.json.
- `pnpm validate` covers both manifest schema and sync drift.
- Drift produces the canonical error message and exit code 1.
- Test suite enforces drift detection so future regressions are caught.
- CI requires no structural change beyond validate already being the entrypoint.
</success_criteria>

<output>
Create `.planning/phases/02-shared-infrastructure/02-05-SUMMARY.md` listing all five Phase-2 plans' artifacts, the npm scripts surface, the canonical drift message, and any CI follow-ups (if ci.yml is absent).
</output>
</content>
</invoke>