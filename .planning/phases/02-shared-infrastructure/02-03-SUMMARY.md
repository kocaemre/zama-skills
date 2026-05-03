---
phase: 02-shared-infrastructure
plan: 03
subsystem: shared-infrastructure
tags: [build, sync, transclusion, markers, codegen, drift-check]
requires:
  - "Plan 02-01 outputs (scripts/lib/versions.ts, pinned-versions.json, deprecated-imports.json)"
  - "Plan 02-02 outputs (shared/context7-query.md, shared/snippets/*, shared/prompts/*)"
provides:
  - "scripts/lib/markers.ts: parseMarkers, replaceMarker, replaceAllMarkers, MarkerError"
  - "scripts/lib/generic.ts: generateGenericFromSkill"
  - "scripts/build.ts: runSync({check}), main() — full sync engine"
  - "Idempotent codegen: SKILL.md transclusion + @pin:<pkg> placeholder resolution + generic/<skill>.md generator + examples/* package.json version sync"
affects:
  - "Plan 02-04 (skill-markers): consumes marker syntax + can run `node ./node_modules/tsx/dist/cli.mjs scripts/build.ts` after marker insertion"
  - "Plan 02-05 (validate-ci): wires `runSync({check:true})` into validate.ts"
  - "Phase 3+ skills: can rely on @sync transclusion working end-to-end"
tech-stack:
  added: []
  patterns:
    - "Iterative marker resolution with cycle detection (cap=100)"
    - "Two-mode CLI: write (default) vs --check (read-only, exit 1 on drift)"
    - "Pin-marker post-processing: <!-- @pin:<pkg> --> resolved from pinned-versions.json"
    - "fs-extra ensureDir for generic/ + atomic file compare-then-write"
key-files:
  created:
    - scripts/lib/markers.ts
    - scripts/lib/markers.test.ts
    - scripts/lib/generic.ts
    - scripts/build.ts
    - generic/init.md
    - generic/contract.md
    - generic/test.md
    - generic/deploy.md
    - generic/frontend.md
  modified: []
decisions:
  - "Marker open-regex restricts kinds to (snippet|prompt|shared) and names to [a-zA-Z0-9_-]+ — matches ORCHESTRATION.md kind convention"
  - "Pin placeholder syntax `<!-- @pin:<pkg> -->` resolved AFTER snippet transclusion, so versions-table.md (which contains pin markers) materializes correctly even when nested inside SKILL.md"
  - "Drift error string verbatim: `Drift detected. Run \\`pnpm sync\\` and commit the result.` (matches ORCHESTRATION drift contract for plan 02-05 reuse)"
  - "examples/ + hardhat.config.ts handled defensively — silently no-op when directories absent (Phase 5 territory)"
  - "Deprecated dep in examples/*/package.json → hard error; incompatible dep → warning only (human-driven fix)"
metrics:
  duration: ~3 min
  completed: 2026-05-03
  tasks: 2
  files: 9
  commits: 3
requirements: [SHARED-04]
---

# Phase 2 Plan 03: Build Script Summary

Implemented the `pnpm sync` engine: HTML-comment marker parser (`scripts/lib/markers.ts`), generic-rehber generator (`scripts/lib/generic.ts`), and the orchestrating `scripts/build.ts` that fans shared content into SKILL.md files, regenerates `generic/<skill>.md`, and rewrites pinned versions inside example `package.json` files. Two modes — write (default) and `--check` (CI dry-run, exit 1 on drift).

## Files Added

| File | Purpose |
|------|---------|
| `scripts/lib/markers.ts` | `parseMarkers`, `replaceMarker`, `replaceAllMarkers`, `MarkerError`. 100-iteration cycle cap. |
| `scripts/lib/markers.test.ts` | 13 vitest cases — parsing all 3 kinds, multi-marker, hyphenated names, unbalanced/nested errors, replacement invariants, idempotency, cycle detection |
| `scripts/lib/generic.ts` | `generateGenericFromSkill(name, content)` — strips YAML frontmatter, prepends auto-gen header |
| `scripts/build.ts` | `runSync({check})`, `main()`, CLI entry. Pipeline: load → SKILL.md transclude → generic gen → examples package.json sync → optional hardhat.config sync |
| `generic/{init,contract,test,deploy,frontend}.md` | Materialized rehberler from Phase 1 SKILL.md skeletons |

## Marker Syntax (binding for plan 02-04)

```
<!-- @sync:snippet:NAME --> body... <!-- @endsync -->
<!-- @sync:prompt:NAME -->  body... <!-- @endsync -->
<!-- @sync:shared:NAME -->  body... <!-- @endsync -->
```

- `kind` ∈ {`snippet`, `prompt`, `shared`}; `NAME` ∈ `[a-zA-Z0-9_-]+`
- Nesting **disallowed** — first-level only. `replaceAllMarkers` resolves recursively across iterations (re-parsing after each edit), so a snippet whose **expanded body** contains another `@sync:` marker IS handled (e.g. `closing-summary.md` transcludes `versions-table.md`).
- Closing token uniform: `<!-- @endsync -->`
- Pin-only placeholder: `<!-- @pin:<pkg> -->` (no closing tag) resolved from `pinned-versions.json` AFTER snippet expansion.

## resolve() Rules

```ts
kind === "snippet" → plugins/zama-skills/shared/snippets/<name>.md
kind === "prompt"  → plugins/zama-skills/shared/prompts/<name>.md
kind === "shared"  → plugins/zama-skills/shared/<name>.md   // for context7-query
```

After loading, the body is post-processed by `resolvePinPlaceholders()` to substitute `<!-- @pin:<pkg> -->` → version string from `getVersion(pkg)`.

## examples/* Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| `examples/` directory absent | Silently skipped (normal pre-Phase-5 state) |
| `examples/<x>/package.json` imports a deprecated dep (e.g. `fhevmjs`) | **Hard error** — reported with `replaces` guidance; file NOT auto-rewritten |
| `examples/<x>/package.json` lists an incompatible package range (e.g. `hardhat@^3`) | **Warning** to stderr; file still rewritten if other deps need pinning |
| `examples/<x>/package.json` dep present in `pinned-versions.json` | Version overwritten in-place, JSON written with `JSON.stringify(obj, null, 2) + "\n"` |
| `examples/<x>/hardhat.config.ts` exists with `@sync:` markers | Markers materialized via `replaceAllMarkers` |
| `examples/<x>/hardhat.config.ts` exists without markers | No-op (string unchanged → `applyFile` skips write) |

## Verification Results

| Check | Status |
|-------|--------|
| `npx vitest run scripts/lib/markers.test.ts` | PASS — 13/13 |
| `npx tsc --noEmit` | PASS — zero errors |
| `node ./node_modules/tsx/dist/cli.mjs scripts/build.ts --check` (pre-write) | exit=1, drift on 5 missing generic/* files |
| `node ./node_modules/tsx/dist/cli.mjs scripts/build.ts` (write) | Synced 5 files; `generic/{init,contract,test,deploy,frontend}.md` created |
| `node ./node_modules/tsx/dist/cli.mjs scripts/build.ts --check` (post-write) | exit=0, no drift |
| Idempotency: re-run write twice | 0 changes second pass |
| LOC budget | `markers.ts` 122 + `generic.ts` 20 + `build.ts` 270 = 412 (under 600 cap) |

## Commits

- `bf04c2a` — `test(02-03): add failing tests for markers parser/replacer` (RED)
- `1cbe3e2` — `feat(02-03): implement marker parser/replacer for sync transclusion` (GREEN)
- `4ff7240` — `feat(02-03): build.ts sync engine + generic generator + check mode`

## Deviations from Plan

**1. [Rule 2 - Critical functionality] Added `<!-- @pin:<pkg> -->` placeholder resolver in build.ts**
- The plan listed pin-resolution as a build-script responsibility, but the marker library only handles `@sync:` markers. Plan 02-02 ships `versions-table.md` with `<!-- @pin:@fhevm/solidity -->` etc., so build.ts MUST resolve them or the materialized SKILL.md will still contain placeholder comments.
- Fix: Added `resolvePinPlaceholders()` (regex `/<!--\s*@pin:([^\s>]+)\s*-->/g`) called after every snippet load AND after final SKILL.md assembly. Falls back to `<!-- @pin:<pkg> (unresolved) -->` if package missing rather than throwing — surfaces missing pins without blocking unrelated sync.
- Files: `scripts/build.ts`. Commit `4ff7240`.

**2. [Rule 3 - Blocking issue] Test file imports use `.js` extension under NodeNext**
- `tsconfig.json` has `module: NodeNext` + `allowImportingTsExtensions: false`, so `from "./markers.ts"` (as written in plan task sketch) fails typecheck. Switched to `from "./markers.js"` (canonical NodeNext convention — runtime resolves to `.ts` via tsx).
- Files: `scripts/lib/markers.test.ts`. Squashed into `1cbe3e2`.

**3. [Tooling] `npx` is intercepted by an `rtk` shim that misroutes `npx tsx`**
- The user environment has rtk/Claude command rewriting that turns `npx tsx scripts/build.ts --check` into `npm tsx --check`, which fails with "Missing script: tsx".
- Workaround used for verification: invoke tsx CLI binary directly: `node ./node_modules/tsx/dist/cli.mjs scripts/build.ts ...`
- Plan 02-05 should wire `pnpm sync` → `tsx scripts/build.ts` in `package.json` scripts (NOT `npx tsx`); pnpm/npm script execution bypasses the rtk shim for binary lookups via `node_modules/.bin`.

No other deviations.

## Gotchas / Notes for Downstream Plans

- **Plan 02-04 (skill-markers):** Closing-summary nesting works — `prompts/closing-summary.md` contains `@sync:snippet:versions-table` and `@sync:snippet:sepolia-faucet` markers; `replaceAllMarkers` re-parses after each substitution so the second pass picks up the freshly-inserted markers and resolves them. **Cap is 100** — if you author a snippet that recursively embeds itself you will get `MarkerError: replaceAllMarkers exceeded 100 iterations`.
- **Plan 02-04:** When you insert markers into SKILL.md skeletons, run `node ./node_modules/tsx/dist/cli.mjs scripts/build.ts` to materialize, then commit BOTH the SKILL.md (with markers + materialized body) AND the regenerated `generic/<skill>.md` files. CI (plan 02-05) will fail otherwise.
- **Plan 02-05 (validate-ci):** Re-export `runSync` from build.ts (already done). Validate.ts can `import { runSync } from "./build.js"` and call `runSync({check:true})`. The drift error string is centralized in `build.ts` as `DRIFT_MSG` constant — prefer importing it rather than duplicating the literal.
- **Plan 02-05:** `package.json` should add `"sync": "tsx scripts/build.ts"` and `"sync:check": "tsx scripts/build.ts --check"`. Do NOT use `npx tsx` (rtk shim collision in dev environments).
- `noUncheckedIndexedAccess: true` is in effect — every `m[1]` / `m[2]` regex group access in markers.ts is non-null-asserted via the regex always producing both groups when matched. The captured `name` is defensively checked with `if (!name) throw MarkerError(...)`.

## Self-Check: PASSED

- [x] `scripts/lib/markers.ts` exists
- [x] `scripts/lib/markers.test.ts` exists
- [x] `scripts/lib/generic.ts` exists
- [x] `scripts/build.ts` exists
- [x] `generic/{init,contract,test,deploy,frontend}.md` exist
- [x] All 3 task commits exist on current branch (`bf04c2a`, `1cbe3e2`, `4ff7240`)
- [x] `npx vitest run scripts/lib/markers.test.ts` → 13/13 PASS
- [x] `npx tsc --noEmit` → zero errors
- [x] `--check` exits 0 after running write mode (idempotency)
- [x] LOC under 600 cap (412 total)
