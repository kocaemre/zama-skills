# Phase 3 Orchestration & Filename Resolution

**Created:** 2026-05-03 (planner)
**Purpose:** Wave structure, naming reconciliation, and pin-resolution strategy for Phase 3 (the critical-path `/zama-init` skill).

## Wave Structure

| Wave | Plans | Parallelizable | Notes |
|------|-------|----------------|-------|
| 1 | 03-01 (skill-body), 03-02 (templates), 03-03 (seeds), 03-05 (helpers) | YES — zero file overlap | Authoring + script work in disjoint dirs |
| 2 | 03-04 (scaffold-runtime) | NO — needs templates + seeds + helpers + versions.ts | Wires everything together |
| 3 | 03-06 (tests) | NO — needs scaffold.ts present | Vitest + smoke harness against runtime |
| 4 | 03-07 (validate-ext) | NO — needs SKILL.md final form + assets on disk | Extends `scripts/validate.ts` only after assets exist |

`files_modified` overlap audit (Wave 1): each plan owns its own subtree.
- 03-01 → `plugins/zama-skills/skills/init/SKILL.md` only
- 03-02 → `plugins/zama-skills/skills/init/assets/templates/**`
- 03-03 → `plugins/zama-skills/skills/init/assets/seeds/**`
- 03-05 → `plugins/zama-skills/skills/init/scripts/{preflight,closing-summary}.ts`

No conflicts.

## Filename Resolution (REQUIREMENTS vs CONTEXT vs orchestrator request)

| Source | Proposed | Resolution (binding) | Why |
|--------|----------|----------------------|-----|
| Orchestrator | `03-NN-<slug>-PLAN.md` | **Use `03-NN-<slug>-PLAN.md`** | Mirrors Phase 2 convention; satisfies GSD `{phase}-{NN}-PLAN.md` rule (slug allowed before `-PLAN.md` per Phase 2 precedent). |
| CONTEXT | `<use-case>-dapp/` target dir | Keep as-is | Scaffold writes to `<cwd>/<use-case>-dapp/`. |
| CONTEXT | `packages/contracts/contracts/<UseCase>.sol` | **Rename to `Token.sol`/`Poll.sol`/`SealedBidAuction.sol`/`Skeleton.sol`** | One canonical contract name per use-case keeps Phase 4 `/zama-contract` deterministic. |

## Pin Resolution Strategy

**Decision: bake at scaffold time, not at sync time.**

Templates ship with `<!-- @pin:<pkg> -->` placeholders (same syntax `scripts/build.ts` already uses for examples). The runtime `scaffold.ts` resolves placeholders by calling `getVersion(pkg)` from `scripts/lib/versions.ts` (loaded relative to the plugin install root via `${CLAUDE_SKILL_DIR}` then walking up to `shared/pinned-versions.json`).

**Rationale:**
- Templates stay human-readable (no committed concrete versions to drift).
- `pnpm sync` does NOT need to materialize templates — keeps Phase 2 build engine scoped to SKILL.md + examples only.
- Single source of truth: `pinned-versions.json`.
- Deprecation guard runs over the *materialized* output (after pin resolution), catching any escape.

## Seed Contract Compile Smoke

03-03 ships seed `.sol` files. We do NOT compile them inside the plugin repo (no Hardhat in `plugins/`). Compile-green is verified by 03-06's integration smoke that scaffolds `confidential-token` into a temp dir and runs `pnpm hardhat compile`. Other 3 seeds verified manually before submission.

## React-Template Drift Risk

Per CLAUDE.md, fhevm-react-template is a moving target. **Phase 3 does NOT clone the template at runtime.** Instead, our templates (03-02) and seeds (03-03) are minimal hand-authored equivalents pinned to versions we control. CONTEXT.md says "Source: fhevm-react-template git clone; post-process..." — we deviate: post-processing a fork in 7 days is a rabbit hole. Hand-authored minimal templates are deterministic and ship-ready.

**This deviation is documented here and surfaced as a risk in 03-04.** Trade-off: less feature-rich frontend out of the box, but compile-green guarantee is much stronger.

## Drift Contract Extension (03-07)

Extend `scripts/validate.ts`:
- Walk `init/assets/**` listed in SKILL.md `<!-- @asset:* -->` references (or whitelisted dir).
- Fail if a referenced asset path is missing.
- Fail if any asset contains a deprecated import (`fhevmjs`, `"fhevm":`).

Reuses the existing `Drift detected. Run \`pnpm sync\`...` error string for missing-asset cases that originate from sync gaps; uses a new `Asset audit failed:` prefix for deprecation hits.

## Out of Scope (deferred)

- `/zama-init --resume` flag (CONTEXT deferred)
- Fork-and-post-process from real fhevm-react-template (deviation above; revisit Phase 6 if time permits)
- Auto-faucet calls (CONTEXT deferred)
- Multi-package frontend variants (Next.js, viem) — mentioned, not shipped
