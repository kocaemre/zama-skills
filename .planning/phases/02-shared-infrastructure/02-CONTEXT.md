# Phase 2: Shared Infrastructure - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning
**Mode:** Smart discuss (4 areas accepted)

<domain>
## Phase Boundary

Phase 2 delivers the single-source-of-truth plumbing that lets all 5 SKILL.md files share:
- Pinned fhEVM package versions (one file → propagated to every skill's assets, examples, and generic docs)
- A common context7-query block (transcluded, not duplicated)
- Shared templates, snippets, and deprecation guardrails used by /zama-init, /zama-contract, /zama-test, /zama-deploy, /zama-frontend

A maintainer must be able to bump `@fhevm/solidity` (or any other Zama package) in exactly one location and run a single command (`pnpm sync`) to regenerate every dependent surface deterministically. CI catches drift via `pnpm sync --check`.

Out of scope: actual skill content (Phase 3, 4), example dApp build (Phase 5), publishing (Phase 6), Sepolia contract addresses (fetched live at runtime — never pinned in source).

</domain>

<decisions>
## Implementation Decisions

### Version Source-of-Truth
- Single file: `plugins/zama-skills/shared/versions.json`
- Schema: `{ packageName: { version, deprecated?: bool, replaces?: string, notes?: string } }` — meta data carries deprecation guardrails (e.g., `fhevmjs` flagged with `replaces: "@zama-fhe/relayer-sdk"`)
- Caret range (`^0.11.1`) in source-of-truth; codegen reduces to exact pin in install instructions when needed
- Sepolia contract addresses are NOT pinned here — only the docs URL is pinned; addresses fetched at skill runtime via context7 / live docs

### Transclusion / Codegen Mechanism
- Build-time codegen via `scripts/sync-shared.ts` (TypeScript, run with `tsx`)
- Source snippets in `plugins/zama-skills/shared/snippets/*.md`
- SKILL.md files contain HTML comment markers: `<!-- @sync:snippet:NAME -->...<!-- @endsync -->`
- Generic markdown rehberler (`generic/cursor.md`, `generic/codex.md`, etc.) auto-generated from SKILL.md — fully idempotent
- `examples/*/package.json` and `examples/*/hardhat.config.ts` are also sync targets (versions get rewritten from `versions.json`)
- Marker syntax: HTML comment markers — uniform across .md, .ts, .json (works inside JSON via wrapper key, see plan)

### Sync Execution & Drift Detection
- Two modes: `pnpm sync` (write mode, maintainer use) and `pnpm sync --check` (CI dry-run, exits 1 on drift)
- CI integration: extend Phase 1's existing validate workflow rather than adding a new job — `scripts/validate.ts` invokes `sync --check` as part of validation
- On drift in CI: fail with clear message `"Drift detected. Run \`pnpm sync\` and commit the result."` (no auto-PR, no auto-commit — keeps timeline tight)
- Script language: TypeScript via `tsx` (matches Phase 1 pattern)

### Shared Directory Layout & Scope
- Layout: `plugins/zama-skills/shared/{versions.json, snippets/*.md, templates/*}` — lives inside the plugin so `/plugin install` copies it
- Phase 2 ships 5 snippets:
  1. `context7-query.md` — the canonical context7 invocation block every SKILL.md transcludes
  2. `versions-table.md` — version pin reference table
  3. `deprecation-guard.md` — explicit "DO NOT import fhevmjs / fhevm root" guardrail
  4. `acl-tip.md` — short ACL pattern reminder
  5. `sepolia-faucet.md` — faucet + RPC + relayer URL block (URLs only, no addresses)
- Phase 2 ships 3 templates (used by Phase 3 `/zama-init`):
  1. `hardhat.config.ts.tpl`
  2. `.env.example.tpl`
  3. `README.header.md.tpl`
- Validator extension: `scripts/validate.ts` is extended with `runSyncCheck()` rather than introducing a separate `scripts/sync.ts` invocation in CI

</decisions>

<code_context>
## Existing Code Insights

Phase 1 established:
- Plugin layout under `plugins/zama-skills/` with 5 SKILL.md skeletons
- `.claude-plugin/marketplace.json` and `plugins/zama-skills/.claude-plugin/plugin.json`
- `scripts/validate.ts` validating marketplace/plugin schemas
- CI workflow `.github/workflows/ci.yml` with vitest + validator (`--passWithNoTests` to bypass empty test suite)
- Package manager: pnpm (per CLAUDE.md examples; align with template)
- Node engine: `>=20`; TypeScript `^5.9.3`

Reusable assets:
- `scripts/validate.ts` — extend with `runSyncCheck()` rather than fork
- `vitest` — already wired; add unit tests for sync logic
- `picocolors` — already a dep, use for sync output
- `fs-extra` — already a dep, use for recursive copy/template materialization
- `zod` — already a dep, validate `versions.json` schema

Established patterns:
- TypeScript scripts run via `tsx` (no build step)
- CI runs `pnpm install --frozen-lockfile && pnpm validate && pnpm test`
- ESM-first, Node 20+

Integration points:
- New: `plugins/zama-skills/shared/` (versions.json, snippets/, templates/)
- New: `scripts/sync-shared.ts` (the regenerator) and `scripts/lib/markers.ts` (marker parser)
- Modify: `scripts/validate.ts` (add sync drift check)
- Modify: `package.json` scripts (add `sync`, `sync:check`)
- Modify: 5 SKILL.md files (insert sync markers around shared blocks — markers + initial content)
- Modify: `.github/workflows/ci.yml` (no change if validate.ts handles it; document in plan)

</code_context>

<specifics>
## Specific Ideas

- Marker format must work inside JSON without breaking parse — use a wrapper convention like `"_sync_versions": "BEGIN/END"` keys or only put markers in .md/.ts files; resolve in plan
- `versions.json` deprecation entries (`fhevmjs`, `fhevm`) must be discoverable so future skills can refuse to emit imports for them — expose helper `isDeprecated(pkgName)` in `scripts/lib/versions.ts`
- All snippet files ship with the canonical content from CLAUDE.md (e.g., context7 query block must reference `/zama-ai/fhevm`, `/zama-ai/fhevm-hardhat-template`, `/websites/openzeppelin_confidential-contracts`)
- Keep the sync script under ~300 LOC — readability over cleverness; this is maintainer-facing infra

</specifics>

<deferred>
## Deferred Ideas

- Auto-PR on drift (deferred — v2; v1 just fails CI with clear instructions)
- Pre-commit hook (deferred — CI is sufficient for v1; lokal hook can be added later without API changes)
- Custom DSL / Handlebars templating (deferred — HTML comment markers + simple string replace are enough)
- Mainnet contract address registry (deferred — Sepolia-only per PROJECT.md)

</deferred>
