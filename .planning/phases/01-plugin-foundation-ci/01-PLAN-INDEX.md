---
phase: 01-plugin-foundation-ci
title: Phase 1 Plan Index
plans: 5
execution: sequential (01 → 02 → 03 → 04 → 05)
---

# Phase 1: Plugin Foundation + CI — Plan Index

**Goal:** A judge can run `/plugin marketplace add <repo>` + `/plugin install zama-skills@zama-skills` and the plugin loads cleanly with all 5 SKILL.md skeletons recognized.

**Requirements covered (5):** PLUGIN-01, PLUGIN-02, PLUGIN-03, PLUGIN-04, PLUGIN-06.
(PLUGIN-05 = `npx ... install` real implementation deferred to Phase 6 per REQUIREMENTS.md traceability.)

## Plans

| ID | File | Objective | Requirements | Depends On |
|----|------|-----------|--------------|------------|
| 01 | `01-PLAN-01-marketplace-plugin-manifest.md` | `.claude-plugin/marketplace.json` + `plugins/zama-skills/.claude-plugin/plugin.json` | PLUGIN-01 | — |
| 02 | `01-PLAN-02-skill-skeletons.md` | 5 SKILL.md skeletons (init/contract/test/deploy/frontend) with valid frontmatter | PLUGIN-02, PLUGIN-03, PLUGIN-04 | 01 |
| 03 | `01-PLAN-03-npm-package-cli.md` | Repo-root `package.json` + `bin/zama-skills.mjs` shim + `commander`-based stub CLI + `tsconfig.json` | PLUGIN-01 (npm fallback path) | 02 |
| 04 | `01-PLAN-04-ci-validation.md` | GitHub Actions workflow + `scripts/validate.ts` (zod) covering all manifests + 5 SKILL.md frontmatter | PLUGIN-06 | 03 |
| 05 | `01-PLAN-05-readme.md` | README selling differentiator in first 30s + dual install path docs | (foundation for DIST-01 in Phase 6) | 04 |

## Execution Order

**Sequential. No parallelism.** Each plan layers on prior scaffolding:
- 02 needs the plugin directory created in 01
- 03 needs to know plugin structure to set `files` field
- 04 validates everything 01-03 produced
- 05 documents the system that 01-04 built

## Locked Decisions Honored

- Marketplace name: `zama-skills`, plugin name: `zama-skills` (CONTEXT D-marketplace-identity)
- **Skill folder names drop `zama-` prefix** → `skills/{init,contract,test,deploy,frontend}/` (resolves RESEARCH.md A5; user-confirmed in phase_info)
- Slash invocation: `/zama-skills:init`, `/zama-skills:contract`, etc.
- Versions pinned to CLAUDE.md verbatim: `commander@^12`, `zod@^3`, `vitest@^2`, `prompts@^2`, `picocolors@^1.1.1`, `fs-extra@^11`, TypeScript `^5.9.3`, Node `>=20`
- `version` field OMITTED from `plugin.json` during dev (Phase 6 pins on submission)
- `claude plugin validate` CLI in CI: best-effort; fall back to zod-only if package name unconfirmed
- `disable-model-invocation: true` ONLY on `deploy` skill
- All 5 skills get `allowed-tools` whitelist
- `init` skill gets `context: fork`

## Source Audit

| Item | Source | Plan |
|------|--------|------|
| PLUGIN-01 (single-command install) | REQ | 01, 03 |
| PLUGIN-02 (5 SKILL.md, ≤1536 char) | REQ | 02 |
| PLUGIN-03 (deploy disable-model-invocation) | REQ | 02 |
| PLUGIN-04 (allowed-tools on every skill) | REQ | 02 |
| PLUGIN-06 (CI schema validation) | REQ | 04 |
| Goal: judge can install + 5 skills load | GOAL | 01, 02 |
| Marketplace identity locked | CONTEXT | 01 |
| Tooling baseline | CONTEXT | 03 |
| Frontmatter conventions | CONTEXT | 02 |
| Standard stack pkg list | RESEARCH | 03 |
| Architectural Responsibility Map | RESEARCH | 01-04 |
| README hooks judge in 30s | phase_info output spec | 05 |

All items COVERED. No gaps.

## Threat Summary (Phase-level)

| Threat | Plan | Mitigation |
|--------|------|------------|
| T-01-01 path traversal in `source` | 01, 04 | zod regex `^\./` + reject `..` |
| T-01-02 reserved marketplace name | 01, 04 | name `zama-skills` verified safe; CI checks against reserved set |
| T-01-03 destructive skill auto-runs | 02 | `allowed-tools` whitelist on all skills; `disable-model-invocation` on deploy |
| T-01-04 stale `version` hides fix | 01 | Omit `version` during dev (commit SHA = version); pin only at submission |
| T-01-05 CI false-green on missing files | 04 | Custom zod validator asserts all 5 SKILL.md exist + invariants |
| T-01-06 npx install untrusted code | 03 | Phase 1 ships STUB only — no fs writes; full impl Phase 6 |

CI has **no secrets** in Phase 1 (NPM_TOKEN added Phase 6).
