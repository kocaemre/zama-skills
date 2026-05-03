---
phase: 01-plugin-foundation-ci
plan: 02
subsystem: plugin-skills-skeleton
tags: [skills, frontmatter, plugin, claude-code]
requires:
  - 01-01 (plugin.json + marketplace.json must exist for skills to load)
provides:
  - 5 SKILL.md skeletons recognized by Claude Code as `/zama-skills:{init,contract,test,deploy,frontend}`
  - PLUGIN-02 (5 skills present)
  - PLUGIN-03 (deploy is manual-only via `disable-model-invocation: true`)
  - PLUGIN-04 (every skill has narrowed `allowed-tools` whitelist)
affects:
  - plugins/zama-skills/skills/* (new tree)
tech-stack:
  added: []
  patterns:
    - "SKILL.md frontmatter conventions: name=folder, description+when_to_use ≤ 1,536 chars"
    - "context: fork on init only (isolated subagent for noisy scaffolding)"
    - "disable-model-invocation: true on deploy only (destructive on-chain action)"
    - "allowed-tools narrowed to specific Bash patterns (no blanket Bash)"
key-files:
  created:
    - plugins/zama-skills/skills/init/SKILL.md
    - plugins/zama-skills/skills/contract/SKILL.md
    - plugins/zama-skills/skills/test/SKILL.md
    - plugins/zama-skills/skills/deploy/SKILL.md
    - plugins/zama-skills/skills/frontend/SKILL.md
  modified: []
decisions:
  - "Skill folder names DROP the `zama-` prefix (per phase_info user-confirmed namespace decision); plugin namespace yields `/zama-skills:init` etc., avoiding doubling"
  - "Bodies left as `<!-- TODO: Phase {N} -->` skeletons; Phases 3-4 flesh out content"
  - "allowed-tools whitelist scoped per-skill: deploy excludes git/mkdir/cp; init includes them for scaffolding"
metrics:
  duration: ~4m
  tasks_completed: 2
  files_created: 5
  files_modified: 0
  completed: 2026-05-03T13:00:37Z
---

# Phase 1 Plan 02: 5 SKILL.md Skeletons with Valid Frontmatter — Summary

Created 5 schema-valid `SKILL.md` skeleton files at `plugins/zama-skills/skills/{init,contract,test,deploy,frontend}/`, satisfying PLUGIN-02/03/04 with the correct invocation properties (`context: fork` on init only, `disable-model-invocation: true` on deploy only, narrowed `allowed-tools` whitelists across all five).

## What Was Built

### Task 1 — Four auto-invoke skill skeletons (commit `c86275c`)

Wrote `init`, `contract`, `test`, and `frontend` SKILL.md files. Frontmatter highlights:

| Skill    | `context: fork` | `disable-model-invocation` | description+when_to_use chars |
|----------|-----------------|----------------------------|-------------------------------|
| init     | yes             | no                         | 427                           |
| contract | no              | no                         | 477                           |
| test     | no              | no                         | 386                           |
| frontend | no              | no                         | 397                           |

All under the 1,536-char cap with comfortable headroom for Phase 3+ description tuning.

`allowed-tools` whitelists are scoped per skill — for example, `init` includes `Bash(git *) Bash(mkdir *) Bash(cp *)` for scaffolding, while `contract` is restricted to `Read Write Edit Glob Grep Bash(npm *) Bash(npx hardhat *) WebFetch` (no shell-mutation tools needed).

### Task 2 — Deploy skeleton (manual-only) (commit `fd2351a`)

Wrote `deploy/SKILL.md` with:

- `disable-model-invocation: true` — Claude cannot auto-invoke (PLUGIN-03)
- No `context: fork` (only init has it)
- Narrow `allowed-tools`: `Read Write Bash(npx hardhat *) Bash(npm run *) Bash(node *) WebFetch` — no git/mkdir/cp; deploy doesn't scaffold
- 343 description+when_to_use chars

## Verification Results

Final plan-level verification (all 5 files):

```
init OK 427 chars
contract OK 477 chars
test OK 386 chars
frontend OK 397 chars
deploy 343 chars
PLAN-02 invariants OK
```

Each invariant from `<verification>` block passed:

- All 5 SKILL.md files exist at canonical paths
- `disable-model-invocation: true` present ONLY on `deploy`
- `context: fork` present ONLY on `init`
- `allowed-tools` present on every skill
- Combined `description` + `when_to_use` ≤ 1,536 chars on every skill

## Deviations from Plan

None — plan executed exactly as written. Bodies of all 5 SKILL.md files are deliberate skeletons (per plan instruction); each contains a clearly-marked `<!-- TODO: Phase {N} -->` comment indicating which downstream phase will populate the content.

## Known Stubs

All 5 SKILL.md bodies are intentional skeletons with TODO markers for Phases 3-4. This is by design (per plan `<objective>`: "Bodies are placeholder — Phase 3+ flesh them out. Phase 1 just needs Claude Code to load the plugin and recognize all 5 skills with the correct invocation properties."). No data-stub or placeholder-rendering risk — these are documentation skeletons, not runtime code paths.

| File | Phase that resolves it |
|------|------------------------|
| `init/SKILL.md` body | Phase 3 (scaffolding workflow) |
| `contract/SKILL.md` body | Phase 4 (contract authoring patterns) |
| `test/SKILL.md` body | Phase 4 (FHE test patterns) |
| `deploy/SKILL.md` body | Phase 4 (Sepolia deploy + verify + registry) |
| `frontend/SKILL.md` body | Phase 4 (relayer-sdk integration) |

## Commits

| Task | Hash      | Message                                                          |
|------|-----------|------------------------------------------------------------------|
| 1    | `c86275c` | feat(01-02): add 4 auto-invoke SKILL.md skeletons                |
| 2    | `fd2351a` | feat(01-02): add deploy SKILL.md skeleton (manual-only)          |

## Self-Check: PASSED

- [x] `plugins/zama-skills/skills/init/SKILL.md` — exists
- [x] `plugins/zama-skills/skills/contract/SKILL.md` — exists
- [x] `plugins/zama-skills/skills/test/SKILL.md` — exists
- [x] `plugins/zama-skills/skills/deploy/SKILL.md` — exists
- [x] `plugins/zama-skills/skills/frontend/SKILL.md` — exists
- [x] commit `c86275c` — present in git log
- [x] commit `fd2351a` — present in git log
