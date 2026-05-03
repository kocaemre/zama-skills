---
phase: 01-plugin-foundation-ci
plan: 04
subsystem: ci-validation
tags: [ci, validation, zod, github-actions]
requires:
  - .claude-plugin/marketplace.json (PLAN-01)
  - plugins/zama-skills/.claude-plugin/plugin.json (PLAN-01)
  - 5 SKILL.md skeletons (PLAN-02)
  - package.json with scripts.validate / typecheck / test (PLAN-03)
provides:
  - npm-script: validate
  - ci-workflow: .github/workflows/ci.yml
affects:
  - every push to main + every PR (CI gate before publish)
tech-stack:
  added:
    - zod ^3.25 (already in devDependencies — first usage here)
  patterns:
    - zod schema validation (parse → throw)
    - GitHub Actions least-privilege permissions
    - best-effort optional CLI step via continue-on-error
key-files:
  created:
    - scripts/validate.ts
    - .github/workflows/ci.yml
    - package-lock.json (npm install side-effect; required by npm ci)
  modified: []
decisions:
  - Zod v3 chosen (already pinned in package.json) for fast schema validation without external YAML lib for plugin manifests
  - Inline minimal YAML frontmatter parser instead of pulling gray-matter — Phase 1 has only 5 simple SKILL.md files; one-line `key: value` parser is sufficient and zero-dep
  - `claude plugin validate` CLI is best-effort only (RESEARCH.md A4 — distribution package not confirmed); zod validator is the actual gate
  - Node 20 only, no matrix — matches Layer B minimum (`>=20`); Node 22 adds zero value for Layer A scaffolding
  - `npm ci` not `npm install` — strict lockfile, fails on drift (T-01-CI-2 mitigation)
  - Validator uses raw-JSON `Object.prototype.hasOwnProperty.call(...)` checks for `version` rejection — zod's `optional()` strips undefined keys, so the schema-parsed object can't tell "absent" from "present-but-undefined"
metrics:
  duration: ~12 min (incl. npm install)
  completed: 2026-05-03
---

# Phase 1 Plan 4: CI Validation Summary

zod-based validator + GitHub Actions workflow that gate every push and PR with manifest + SKILL.md invariant checks.

## Tasks Executed

| Task | Name                                | Commit  | Files                          |
| ---- | ----------------------------------- | ------- | ------------------------------ |
| 1    | Write scripts/validate.ts (zod)     | 07b1ec0 | scripts/validate.ts, package-lock.json |
| 2    | Write GitHub Actions CI workflow    | 9fc99a9 | .github/workflows/ci.yml       |

## Validator Coverage (scripts/validate.ts)

Single run; first failure aggregates with all others before exit 1.

**Marketplace (`.claude-plugin/marketplace.json`):**
- Kebab-case `name`
- Owner block with name + optional email
- ≥1 plugin entry, each with kebab-case name and `^\./`-prefixed source (no `..`)
- Reserved-name rejection (8 names: agent-skills, claude-code-marketplace, claude-plugins-official, anthropic-marketplace, anthropic-plugins, claude-code-plugins, knowledge-work-plugins, life-sciences)
- `plugins[0].source` MUST equal `./plugins/zama-skills`
- `version` field forbidden during dev (commit SHA = version)

**Plugin manifest (`plugins/zama-skills/.claude-plugin/plugin.json`):**
- Kebab-case `name`, MUST equal `zama-skills`
- `version` forbidden during dev
- `.claude-plugin/` directory must contain only `plugin.json` (no extras)

**SKILL.md frontmatter (5 skills: init, contract, test, deploy, frontend):**
- Each skill folder must have `SKILL.md` with valid YAML frontmatter
- `name` matches folder slug (kebab-case, ≤64 chars)
- `description` and `when_to_use` both non-empty; combined ≤ 1,536 chars (Anthropic spec)
- `allowed-tools` non-empty whitelist (UX: avoids permission prompts mid-workflow)
- **Positive AND negative checks:**
  - `disable-model-invocation: true` REQUIRED on `deploy` only; forbidden on others
  - `context: fork` REQUIRED on `init` only; forbidden on others

## CI Workflow (.github/workflows/ci.yml)

- Triggers: push to `main`, all pull_requests
- Single job, Node 20, ubuntu-latest, 10-min timeout
- `permissions: contents: read` only — zero secrets referenced
- Mandatory gates (in order): `npm ci --no-audit --no-fund` → `npm run validate` → `npx tsc --noEmit` → `npm test`
- Best-effort step (`continue-on-error: true`): `claude plugin validate .` via `npx --yes --package=@anthropic-ai/claude-code` — emits a workflow notice when CLI unavailable, never blocks the pipeline

## Verification Performed

```bash
$ npm run validate
✓ marketplace + plugin + 5 SKILL.md frontmatters valid

$ npx tsc --noEmit
TypeScript: No errors found
```

YAML linter (`js-yaml`, Python `yaml`) was unavailable in the local sandbox, so workflow YAML was verified by:
- grep-level shape checks (per plan verification): all required keys present, no `NPM_TOKEN`, no `secrets.` references, `continue-on-error: true` only on the best-effort step
- CI itself will exercise the workflow on the next push/PR

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Strict TypeScript fixes for `noUncheckedIndexedAccess`**
- **Found during:** Task 1 (during typecheck)
- **Issue:** Plan's verbatim validator code triggered 7 strict-mode errors (TS18048/TS2538/TS2532) under `noUncheckedIndexedAccess`-enabled tsconfig
- **Fix:** Added explicit undefined guards on regex match groups, destructured `kv[1]/kv[2]` instead of array destructuring, asserted `m[1]` truthy, captured `mp.plugins[0]` into a local
- **Files modified:** scripts/validate.ts
- **Commit:** 07b1ec0

**2. [Rule 2 - Critical] Enforce `version` rejection via raw-JSON hasOwnProperty**
- **Found during:** Task 1
- **Issue:** Plan suggested `'version' in mp.plugins[0]` after zod parse — but zod strips unknown keys and optional `version` defined in schema means the property may not survive parse if absent
- **Fix:** Check `Object.prototype.hasOwnProperty.call(rawJson, 'version')` against the raw parsed JSON, not the zod result. Same fix applied to plugin.json check.
- **Files modified:** scripts/validate.ts
- **Commit:** 07b1ec0

**3. [Rule 2 - Critical] Strip surrounding quotes in YAML frontmatter parser**
- **Found during:** Task 1 (defensive)
- **Issue:** Plan's minimal YAML parser would treat `name: "init"` as literal string `"init"` (with quotes), failing skill-name match
- **Fix:** Strip surrounding single/double quotes after trimming
- **Files modified:** scripts/validate.ts
- **Commit:** 07b1ec0

No architectural deviations. No checkpoints. No auth gates.

## Self-Check: PASSED

**Files:**
- FOUND: scripts/validate.ts
- FOUND: .github/workflows/ci.yml
- FOUND: package-lock.json (committed in 07b1ec0)
- FOUND: .planning/phases/01-plugin-foundation-ci/01-04-SUMMARY.md

**Commits:**
- FOUND: 07b1ec0 — feat(01-04): add zod-based plugin/skill validator
- FOUND: 9fc99a9 — feat(01-04): add GitHub Actions CI workflow

**Invariants verified live:**
- `npm run validate` exits 0 with success message
- `npx tsc --noEmit` reports 0 errors
- ci.yml grep checks: contains `npm run validate`, `node-version: '20'`, `permissions:`, `continue-on-error: true`; does NOT contain `NPM_TOKEN` or `secrets.`

## TDD Gate Compliance

Not applicable — plan `type: execute`, not `type: tdd`.
