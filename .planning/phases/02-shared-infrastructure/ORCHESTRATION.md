# Phase 2 Orchestration & Filename Resolution Notes

**Created:** 2026-05-03 (planner)
**Purpose:** Reconcile naming differences between REQUIREMENTS.md (authoritative for required filenames) and 02-CONTEXT.md (authoritative for user-affirmed decisions).

## Wave Structure

| Wave | Plans | Parallelizable | Notes |
|------|-------|----------------|-------|
| 1 | 02-01 (pinned-versions), 02-02 (shared-content) | YES — zero file overlap | Data + content authoring, fully independent |
| 2 | 02-03 (build-script) | NO — depends on Wave 1 outputs | Needs versions.ts + snippet content present |
| 3 | 02-04 (skill-markers) | NO — depends on build script | Inserts markers + runs the script |
| 4 | 02-05 (validate-ci) | NO — depends on materialized tree | Wires drift check into validate pipeline |

## Filename Resolution (REQUIREMENTS vs CONTEXT)

| Required by REQUIREMENTS.md | CONTEXT.md proposed | Resolution (binding) | Why |
|-----------------------------|---------------------|----------------------|-----|
| `shared/pinned-versions.json` (SHARED-01) | `shared/versions.json` | **Use `pinned-versions.json`** | REQUIREMENTS is the spec contract; CONTEXT is a discussion artifact. SHARED-01 names the filename verbatim. |
| `shared/context7-query.md` (SHARED-02) | implied under `snippets/` | **Use `shared/context7-query.md` (top-level)** | SHARED-02 spec; treat as a first-class "shared" kind, distinct from snippets/ |
| `shared/deprecated-imports.json` (SHARED-03) | embedded in versions.json `deprecated:` field | **Author as separate file** | SHARED-03 spec wants a discrete file. Build script can cross-validate consistency in v2 if both exist. |
| `scripts/build.mjs` (SHARED-04) | `scripts/sync-shared.ts` (TS via tsx) | **Use `scripts/build.ts` + `tsx scripts/build.ts`** | Phase 1 established TS-via-tsx. The `.mjs` requirement is satisfied at runtime — `tsx` produces ESM output equivalent to `.mjs`. Document as deviation. npm script `pnpm sync` → `tsx scripts/build.ts`. |
| `shared/prompts/` (SHARED-05) | only mentioned via Phase 6 transclusion | **Author all 3 prompts in Phase 2** | Per SHARED-05 spec; transclusion into SKILL.md done in plan 02-04 |

## Marker Kind Convention

Three sync-marker kinds, materialized by `scripts/build.ts`:

- `<!-- @sync:shared:NAME -->` → reads `plugins/zama-skills/shared/NAME.md` (used for `context7-query`)
- `<!-- @sync:snippet:NAME -->` → reads `plugins/zama-skills/shared/snippets/NAME.md`
- `<!-- @sync:prompt:NAME -->` → reads `plugins/zama-skills/shared/prompts/NAME.md`

Closing token (uniform): `<!-- @endsync -->`.

## Per-SKILL Marker Plan (cross-reference for Phase 3/4)

| Skill | Markers Inserted (Phase 2 plan 02-04) |
|-------|----------------------------------------|
| init | shared:context7-query, prompt:anti-deprecation, snippet:deprecation-guard, snippet:versions-table, snippet:sepolia-faucet, prompt:closing-summary |
| contract | shared:context7-query, prompt:anti-deprecation, snippet:deprecation-guard, snippet:versions-table, snippet:acl-tip, prompt:decryption-paths |
| test | shared:context7-query, prompt:anti-deprecation, snippet:deprecation-guard, snippet:versions-table, snippet:acl-tip |
| deploy | shared:context7-query, prompt:anti-deprecation, snippet:deprecation-guard, snippet:versions-table, snippet:sepolia-faucet, prompt:closing-summary |
| frontend | shared:context7-query, prompt:anti-deprecation, snippet:deprecation-guard, snippet:versions-table, prompt:decryption-paths |

## Drift Contract (binding for CI)

- Single canonical error string (must appear verbatim in both validate.ts and build.ts):
  `Drift detected. Run \`pnpm sync\` and commit the result.`
- Single CI entrypoint: `pnpm validate` (which invokes runSync({check:true}) internally).
- No new GitHub Actions job required — Phase 1's existing `validate` step handles it.

## Out of Scope (deferred to v2)

- Auto-PR on drift (CONTEXT deferred)
- Pre-commit hook (CONTEXT deferred)
- Custom DSL / Handlebars (CONTEXT deferred)
- Mainnet contract registry (PROJECT scope)
- `examples/*` content (Phase 5; build script handles them defensively if absent)
