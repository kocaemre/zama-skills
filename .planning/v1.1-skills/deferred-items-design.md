# Deferred Items — design skill

## Pre-existing tests now failing due to skill count change

Three parallel executor agents are each adding a new skill (`design`, `audit`, `debug`) under `plugins/zama-skills/skills/`. After all merges, the skill directory count grows from 5 to 8. The following tests have hard-coded expectations of "5 skills" and will need to be updated by the orchestrator after wave merge — fixing them in any single executor would conflict with the parallel agents.

- `scripts/generate-generic-docs.test.mjs:101` — `expect(writtenPaths).toHaveLength(5)` → should become `8` post-merge.
- `scripts/generate-generic-docs.test.mjs:104` — hard-coded sorted name list `["contract.md", "deploy.md", "frontend.md", "init.md", "test.md"]` → needs `audit.md`, `debug.md`, `design.md` appended.
- `scripts/validate.test.ts` — drift-detection assertion array length `[…(6) ]` vs `5` (off-by-one from a test fixture; same root cause: new skill registered).
- `scripts/validate.test.ts` — runSync subprocess returns null exit (likely re-running on a now-dirty tree because a new SKILL.md was added but `generic/design.md` not regenerated; orchestrator should run `pnpm generic` after merge).

## Marketplace + generic-docs regeneration

- `marketplace.json` — owned by orchestrator per executor instructions.
- `generic/design.md` — should be auto-generated via `pnpm generic` after merge; do NOT pre-generate here (would conflict with parallel agents' skill additions).
