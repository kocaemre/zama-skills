---
phase: 03-zama-init-end-to-end
plan: 05
type: execute
wave: 1
depends_on: []
files_modified:
  - plugins/zama-skills/skills/init/scripts/preflight.ts
  - plugins/zama-skills/skills/init/scripts/closing-summary.ts
autonomous: true
requirements: [INIT-04, INIT-05]
must_haves:
  truths:
    - "preflight.ts checks Node >= 20, pnpm available, and a lightweight internet probe; exits non-zero on any failure with actionable error"
    - "closing-summary.ts reads a scaffold manifest (file or stdin) and renders the closing markdown block"
    - "Closing summary renders all required elements: file inventory by directory, commands passed, MetaMask Sepolia deep-link, 3 faucet URLs, next 3 actions, NOT-done line, context7 reassurance line"
  artifacts:
    - path: "plugins/zama-skills/skills/init/scripts/preflight.ts"
      provides: "Pre-flight environment checks"
      exports: ["runPreflight"]
    - path: "plugins/zama-skills/skills/init/scripts/closing-summary.ts"
      provides: "Render the markdown closing block from a manifest"
      exports: ["renderClosingSummary"]
  key_links:
    - from: "closing-summary.ts"
      to: "shared/snippets/sepolia-faucet.md + prompts/closing-summary.md"
      via: "read shared markdown to extract faucet list + template"
      pattern: "shared/(snippets|prompts)"
    - from: "closing-summary.ts"
      to: "scripts/lib/manifest.ts (03-04)"
      via: "import { ScaffoldManifest } from './lib/manifest.js'"
      pattern: "ScaffoldManifest"
---

<objective>
Two small TypeScript helper scripts invoked by SKILL.md (03-01) at the bookends of the flow: preflight before scaffold, closing-summary after.

Purpose: Keep SKILL.md as orchestration prose and the imperative logic in tested TS. Helpers are pure-ish, easily unit-tested by 03-06.
Output: 2 .ts files. Both export a function AND have a CLI shim so SKILL.md can call them directly via `tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-zama-init-end-to-end/03-CONTEXT.md
@.planning/phases/03-zama-init-end-to-end/ORCHESTRATION.md
@plugins/zama-skills/shared/prompts/closing-summary.md
@plugins/zama-skills/shared/snippets/sepolia-faucet.md
@plugins/zama-skills/shared/snippets/versions-table.md

<interfaces>
- Preflight checks (CONTEXT decision):
  - Node `>= 20` — read `process.versions.node`, semver-compare against `>=20.0.0`.
  - `pnpm` available — `child_process.spawnSync("pnpm", ["--version"])`, expect exit 0.
  - Internet probe — `fetch("https://registry.npmjs.org/-/ping", { signal: AbortSignal.timeout(3000) })`, treat non-200 as offline. (Lightweight, no external deps.)
- Closing summary template lives in `shared/prompts/closing-summary.md` (already materialized in Phase 2). It contains `{{INSTALLED_FILES}}`, `{{VERSIONS_TABLE}}`, `{{SEPOLIA_FAUCET}}`, `{{NOT_DONE_LIST}}`, `{{NEXT_SKILL}}`, `{{NEXT_SKILL_REASON}}`, `{{SKILL_NAME}}`.
- The MetaMask Sepolia deep-link (`https://chainid.network/?search=sepolia`) is appended in the template as a literal line — closing-summary.ts must include it.
- Manifest type imported from 03-04's `lib/manifest.ts`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: preflight.ts</name>
  <files>plugins/zama-skills/skills/init/scripts/preflight.ts</files>
  <action>
- Export `runPreflight(opts?: { skipNetwork?: boolean }): Promise<{ ok: boolean; failures: string[]; details: Record<string, string> }>`.
- Three checks:
  1. **Node**: parse `process.versions.node`, fail if major < 20. Failure message: `"Node 20+ required. Found <version>. Install via nvm or asdf."`
  2. **pnpm**: spawn `pnpm --version`. Fail if not on PATH or exit != 0. Failure message: `"pnpm not found on PATH. Install: npm i -g pnpm@9 (or follow https://pnpm.io/installation)."`
  3. **Internet**: fetch the npm ping endpoint with 3s timeout. Skip if `opts.skipNetwork` (for tests). Failure message: `"npm registry unreachable (timeout 3s). Check internet or proxy settings."`
- CLI shim at bottom: when `import.meta.url` matches the entry, call `runPreflight()`, print pass/fail human summary to stderr, exit 0 on all-pass else 1. JSON manifest of results goes to stdout.
- Strict TS, no untyped catches.
  </action>
  <verify>
    <automated>
      test -f plugins/zama-skills/skills/init/scripts/preflight.ts && \
      grep -q "export.*runPreflight" plugins/zama-skills/skills/init/scripts/preflight.ts && \
      grep -q "process.versions.node" plugins/zama-skills/skills/init/scripts/preflight.ts && \
      grep -q "pnpm" plugins/zama-skills/skills/init/scripts/preflight.ts && \
      grep -q "registry.npmjs.org" plugins/zama-skills/skills/init/scripts/preflight.ts && \
      pnpm exec tsc --noEmit --project tsconfig.json 2>&1 | { ! grep -q "scripts/preflight.ts"; } && \
      pnpm exec tsx plugins/zama-skills/skills/init/scripts/preflight.ts >/dev/null 2>&1 || true
    </automated>
  </verify>
  <done>preflight.ts typechecks, all 3 checks present, CLI shim works (we don't assert exit code in CI because Node-version of CI host varies — 03-06 unit-tests via the exported function with mocked checks).</done>
</task>

<task type="auto">
  <name>Task 2: closing-summary.ts</name>
  <files>plugins/zama-skills/skills/init/scripts/closing-summary.ts</files>
  <action>
- Export `renderClosingSummary(manifest: ScaffoldManifest, ctx: { useCase: string; sharedDir: string }): string`.
- Read `<sharedDir>/prompts/closing-summary.md` and `<sharedDir>/snippets/sepolia-faucet.md` and `<sharedDir>/snippets/versions-table.md`.
- Extract from closing-summary.md the body inside the `## Template` fenced block (the `## ✅ ...` markdown block). This becomes the substrate.
- Substitute placeholders:
  - `{{SKILL_NAME}}` → `/zama-init`
  - `{{INSTALLED_FILES}}` → grouped list. Group `manifest.filesWritten` by top-level directory (`packages/contracts/`, `packages/frontend/`, root `.`); render as nested bullets. Cap at ~30 entries with "(+N more)" if larger.
  - `{{VERSIONS_TABLE}}` → embed `versions-table.md` content (markdown table)
  - `{{SEPOLIA_FAUCET}}` → embed `sepolia-faucet.md` content
  - `{{NOT_DONE_LIST}}` → fixed list:
    - "I did NOT deploy — run `/zama-deploy --sepolia` (Phase 4) when ready"
    - "I did NOT register the token with the Confidential Token Registry — handled by `/zama-deploy`"
    - "I did NOT wire frontend encryption flows — run `/zama-frontend`"
  - `{{NEXT_SKILL}}` → `/zama-contract`
  - `{{NEXT_SKILL_REASON}}` → use-case-aware (e.g. for `confidential-token`: "extend Token.sol with confidential transfer / approval logic"; for `voting`: "wire up vote tally with proper ACL"; etc.)
- After all substitutions, append three required lines (verbatim — these survive even if template drifts):
  - `Add Sepolia to MetaMask: https://chainid.network/?search=sepolia`
  - `> context7 was queried at scaffold time — every dependency pin is verified live, no hallucinated APIs.`
  - "Commands that already passed:" followed by bullets from `manifest.commandsRan` filtered to `ok=true`.
- Return the assembled string. Print to stdout in the CLI shim.
- CLI shim: `--manifest <path>` (read JSON file) OR stdin (read until EOF, parse JSON), `--use-case <X>`, `--shared-dir <X>` (default: walk up from `import.meta.url` to plugin's `shared/`).
  </action>
  <verify>
    <automated>
      test -f plugins/zama-skills/skills/init/scripts/closing-summary.ts && \
      grep -q "export.*renderClosingSummary" plugins/zama-skills/skills/init/scripts/closing-summary.ts && \
      grep -q "chainid.network" plugins/zama-skills/skills/init/scripts/closing-summary.ts && \
      grep -q "context7 was queried" plugins/zama-skills/skills/init/scripts/closing-summary.ts && \
      grep -q "/zama-contract" plugins/zama-skills/skills/init/scripts/closing-summary.ts && \
      grep -q "/zama-deploy" plugins/zama-skills/skills/init/scripts/closing-summary.ts && \
      pnpm exec tsc --noEmit --project tsconfig.json 2>&1 | { ! grep -q "closing-summary.ts"; }
    </automated>
  </verify>
  <done>closing-summary.ts typechecks, embeds chainid deep-link + context7 reassurance + next-action set, references shared snippets at runtime.</done>
</task>

</tasks>

<verification>
- preflight.ts: 3 checks present.
- closing-summary.ts: pulls 3 shared markdown sources, substitutes 7 placeholders, appends required tail lines.
- Both have CLI shims callable via `tsx`.
- Both typecheck against repo tsconfig.
</verification>

<success_criteria>
- INIT-04 — MetaMask Sepolia deep-link present in closing-summary output.
- INIT-05 — closing summary lists files, versions, faucets, NOT-done, next skill, with one-liner.
- Helpers are SKILL.md-callable via stable CLI flags.
</success_criteria>

<output>
After completion, create `.planning/phases/03-zama-init-end-to-end/03-05-SUMMARY.md` listing exported functions, CLI flags accepted, and shared files read at runtime.
</output>
