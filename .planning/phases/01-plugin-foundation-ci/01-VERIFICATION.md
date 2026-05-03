---
phase: 01-plugin-foundation-ci
verified: 2026-05-03T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (static); 1 live-session test pending
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Run `/plugin marketplace add <repo-url>` then `/plugin install zama-skills@zama-skills` in a real Claude Code session and confirm all 5 slash commands (`/zama-skills:init`, `:contract`, `:test`, `:deploy`, `:frontend`) appear and load"
    expected: "Claude Code surfaces 5 commands; deploy is marked manual-only (no auto-invoke); init reports `context: fork`"
    why_human: "Verifier cannot launch a live Claude Code session; goal is explicitly judge-facing — final confirmation requires a real client"
  - test: "Confirm GitHub Actions CI run on a real push completes green"
    expected: "All gate steps pass: `npm ci` → `npm run validate` → `npx tsc --noEmit` → `npm test`"
    why_human: "CI workflow has not yet been exercised on GitHub. Local reproduction shows `npm test` exits 1 with `No test files found` (vitest default). See WARNING below — may break CI on first push."
warnings:
  - issue: "vitest exits with code 1 when no test files are present (no `passWithNoTests` flag, no vitest.config.ts)"
    impact: "First push to main / first PR will fail at the `npm test` step in `.github/workflows/ci.yml`. The validate + typecheck gates pass first, but the overall CI run will be red, blocking PLUGIN-06's intent of ‘CI green on every push'."
    severity: "WARNING (not BLOCKER) — the validation logic itself is correct and runs before npm test; remediation is a one-line script change (`vitest run --passWithNoTests`) or omitting the npm test step until Phase 2 ships actual tests"
    suggested_fix: "Update `package.json` `scripts.test` to `vitest run --passWithNoTests` OR remove the `npm test` step from ci.yml until Phase 2 introduces test files"
  - issue: "marketplace.json + plugin.json contain literal placeholder `<owner>` in homepage/repository URLs"
    impact: "Cosmetic — does not block plugin loading or schema validation. Phase 6 (DIST-05) replaces with real GitHub owner."
    severity: "INFO — intentional per planning artifacts"
---

# Phase 1: Plugin Foundation + CI — Verification Report

**Phase Goal:** A judge can run `/plugin marketplace add` + `/plugin install zama-skills@zama-skills` against the GitHub repo and the plugin loads cleanly with all 5 SKILL.md skeletons recognized.

**Verified:** 2026-05-03
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PLUGIN-01: marketplace.json + plugin.json exist at canonical paths and parse | ✓ VERIFIED | `.claude-plugin/marketplace.json` (780B) and `plugins/zama-skills/.claude-plugin/plugin.json` (454B) both parse as JSON; zod schemas pass (`npm run validate` exits 0). `plugins[0].source` correctly = `./plugins/zama-skills`; marketplace name `zama-skills` not on reserved list. |
| 2 | PLUGIN-02: 5 SKILL.md files at canonical skill folders (init/contract/test/deploy/frontend) | ✓ VERIFIED | All 5 files exist: `plugins/zama-skills/skills/{init,contract,test,deploy,frontend}/SKILL.md`. Each has valid YAML frontmatter with `name` matching folder slug; `description` + `when_to_use` non-empty and combined ≤1,536 chars (validator enforces). |
| 3 | PLUGIN-03: deploy SKILL.md has `disable-model-invocation: true`; init SKILL.md has `context: fork` | ✓ VERIFIED | `skills/deploy/SKILL.md` line 5: `disable-model-invocation: true`. `skills/init/SKILL.md` line 5: `context: fork`. Validator checks both positively (required on these) AND negatively (forbidden on others). |
| 4 | PLUGIN-04: All 5 SKILL.md have non-empty `allowed-tools` whitelist | ✓ VERIFIED | All 5 frontmatters declare `allowed-tools` with concrete tool list; zod schema requires `min(1)`. Examples — init: `Bash(git *) Bash(npm *) ... Read Write Edit Glob Grep WebFetch`; deploy: `Read Write Bash(npx hardhat *) Bash(npm run *) Bash(node *) WebFetch`. |
| 5 | PLUGIN-06: CI workflow validates JSON shapes + invariants on every push | ✓ VERIFIED (static) / ⚠ unproven on real runner | `.github/workflows/ci.yml` triggers on push-to-main and all pull_requests, sets up Node 20, runs `npm ci` → `npm run validate` (zod gate) → `npx tsc --noEmit` → `npm test`. Permissions locked to `contents: read`, no secrets. Best-effort `claude plugin validate` step uses `continue-on-error: true`. NB: see WARNING — `npm test` will exit 1 on first run because vitest finds no test files. |

**Score:** 5/5 must-haves verified statically. Item 5 has a runtime warning that may cause first CI run to fail on the test step (post-validation).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.claude-plugin/marketplace.json` | Schema-valid marketplace catalog with `zama-skills` plugin entry | ✓ VERIFIED | Parses, passes zod schema, kebab-case name, `./plugins/zama-skills` source, no `version` field (correct per dev convention) |
| `plugins/zama-skills/.claude-plugin/plugin.json` | Schema-valid plugin manifest | ✓ VERIFIED | name=`zama-skills`, no version field, `.claude-plugin/` directory contains only `plugin.json` (validator checks this) |
| `plugins/zama-skills/skills/init/SKILL.md` | Frontmatter with `context: fork`, `allowed-tools`, `name: init` | ✓ VERIFIED | All present; body is a labeled skeleton noting Phase 3 fleshout |
| `plugins/zama-skills/skills/contract/SKILL.md` | Frontmatter with `allowed-tools`, `name: contract` | ✓ VERIFIED | All present; auto-invocable (no `disable-model-invocation`); skeleton body |
| `plugins/zama-skills/skills/test/SKILL.md` | Frontmatter with `allowed-tools`, `name: test` | ✓ VERIFIED | All present; auto-invocable; skeleton body |
| `plugins/zama-skills/skills/deploy/SKILL.md` | Frontmatter with `disable-model-invocation: true`, `allowed-tools`, `name: deploy` | ✓ VERIFIED | All present; manual-only correctly set |
| `plugins/zama-skills/skills/frontend/SKILL.md` | Frontmatter with `allowed-tools`, `name: frontend` | ✓ VERIFIED | All present; auto-invocable; skeleton body |
| `scripts/validate.ts` | zod validator covering manifests + 5 SKILL.md frontmatters | ✓ VERIFIED | 237 lines; covers MarketplaceSchema, PluginSchema, SkillFrontmatterSchema; positive + negative checks for `disable-model-invocation` and `context: fork`; reserved-marketplace-name list (8 names); raw-JSON `hasOwnProperty` for `version` rejection; aggregates errors before exit 1 |
| `.github/workflows/ci.yml` | GitHub Actions workflow with Node 20 + validate gate | ✓ VERIFIED | Triggers push+PR, Node 20, ubuntu-latest, 10-min timeout, `permissions: contents: read`, mandatory steps, best-effort optional CLI step |
| `package.json` | npm scripts validate/test/typecheck + bin shim | ✓ VERIFIED | All scripts present; `bin.zama-skills` → `./bin/zama-skills.mjs`; engines `node >=20`; deps pinned per CLAUDE.md (commander ^12, zod ^3, vitest ^2, prompts ^2, picocolors ^1.1.1, fs-extra ^11, TS ^5.9.3) |
| `bin/zama-skills.mjs` | CLI entrypoint shim | ✓ VERIFIED | Uses tsx to invoke `src/cli/index.ts`; cross-platform shell flag |
| `README.md` | Mentions both install paths + judge-facing differentiator in first 30s | ✓ VERIFIED | First 30 lines lead with context7 differentiator; both install paths in `## Install` (lines 17–29): plugin marketplace command + `npx zama-skills install` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| marketplace.json | plugins/zama-skills | `plugins[0].source: "./plugins/zama-skills"` | ✓ WIRED | Validator asserts exact string match |
| plugin.json | 5 skills | Convention: `<plugin>/skills/<slug>/SKILL.md` auto-discovered by Claude Code | ✓ WIRED | Folder layout matches Anthropic skills spec; validator confirms all 5 slugs present |
| ci.yml validate step | scripts/validate.ts | `npm run validate` → `tsx scripts/validate.ts` | ✓ WIRED | Confirmed via local run: exits 0 with `✓ marketplace + plugin + 5 SKILL.md frontmatters valid` |
| ci.yml test step | (test files) | `npm test` → `vitest run` | ⚠ PARTIAL | No test files exist; vitest exits 1 — see warnings frontmatter |
| package.json bin | bin/zama-skills.mjs | `bin.zama-skills` field | ✓ WIRED | Path resolves; shim further dispatches to `src/cli/index.ts` (verified present) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Validator runs and confirms all invariants | `npm run validate` | `✓ marketplace + plugin + 5 SKILL.md frontmatters valid` (exit 0) | ✓ PASS |
| Strict TS compiles with no errors | `npx tsc --noEmit` | `TypeScript: No errors found` (exit 0) | ✓ PASS |
| Vitest runs | `npm test` | `No test files found, exiting with code 1` | ✗ FAIL (warning — see frontmatter; does not block plugin functionality, but will turn first CI run red) |
| 5 SKILL.md files exist at canonical paths | `ls plugins/zama-skills/skills/{init,contract,test,deploy,frontend}/SKILL.md` | All 5 listed (1.2K, 1.2K, 967B, 1.2K, 1.0K) | ✓ PASS |
| marketplace.json parses as JSON | `node -e "JSON.parse(...)"` (implicit via validator) | OK | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PLUGIN-01 | 01, 03 | Single-command install via marketplace + plugin.json | ✓ SATISFIED | Manifests at canonical paths, schema-valid, npm bin shim present |
| PLUGIN-02 | 02 | 5 SKILL.md files, frontmatter ≤1536 char | ✓ SATISFIED | All 5 present; zod enforces 1536-char cap |
| PLUGIN-03 | 02 | deploy has `disable-model-invocation: true` | ✓ SATISFIED | Verified line 5 of `skills/deploy/SKILL.md`; validator double-enforces |
| PLUGIN-04 | 02 | `allowed-tools` whitelist on every skill | ✓ SATISFIED | All 5 declare non-empty `allowed-tools` |
| PLUGIN-06 | 04 | CI schema validation | ✓ SATISFIED (with warning) | ci.yml runs `npm run validate` on push+PR; see WARNING about npm test step blocking green build |

PLUGIN-05 (`npx zama-skills install` real implementation) is explicitly deferred to Phase 6 per `01-PLAN-INDEX.md` and `REQUIREMENTS.md`. Phase 1 ships only the bin shim + commander stub. Not in scope for this verification.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `marketplace.json` | 14, 15 | Literal `<owner>` placeholder in homepage/repository URLs | INFO | Intentional — Phase 6 fills with real owner per planning. Does not break plugin loading. |
| `plugin.json` | 8, 9 | Same `<owner>` placeholder | INFO | Same as above |
| 5 SKILL.md files | bodies | `<!-- TODO: Phase X — flesh out ... -->` | INFO | Phase 1 is explicitly scoped to skeletons; bodies fleshed out in Phases 3–4 per plan |
| `package.json` test script | line 44 | `vitest run` without `--passWithNoTests` and no test files yet | WARNING | First CI run will fail at npm test step. See warnings frontmatter and human_verification[1]. |

### Human Verification Required

1. **Live `/plugin marketplace add` test** — Run `/plugin marketplace add <repo-url>` then `/plugin install zama-skills@zama-skills` in a real Claude Code session against the published GitHub repo. Confirm all 5 commands appear (`/zama-skills:init`, `:contract`, `:test`, `:deploy`, `:frontend`). The verifier cannot launch a live Claude Code client.

2. **First green CI run** — Push to GitHub and confirm `.github/workflows/ci.yml` completes green. If `npm test` fails as predicted, apply suggested fix (`vitest run --passWithNoTests` or remove npm test step until Phase 2).

### Gaps Summary

No goal-level gaps. All 5 PLUGIN-0X must-haves are satisfied by present, schema-valid artifacts. The validator covers every invariant the goal requires (marketplace + plugin manifests + 5 SKILL.md frontmatters, including positive/negative `disable-model-invocation` and `context: fork` checks).

One real-world warning: `npm test` will exit 1 on first CI run because no vitest files exist yet and there's no `passWithNoTests` flag. This does not affect the plugin's ability to load — it affects whether the CI badge will be green. Recommended one-line fix:

```diff
- "test": "vitest run",
+ "test": "vitest run --passWithNoTests",
```

OR temporarily remove the `npm test` step from ci.yml until Phase 2 ships actual test files.

Status `human_needed` rather than `passed` because the phase goal is judge-facing ("a judge can run `/plugin marketplace add`") — that flow can only be confirmed by a real Claude Code session and a real GitHub-hosted CI run, neither of which the verifier can execute.

---

_Verified: 2026-05-03_
_Verifier: Claude (gsd-verifier)_
