---
phase: 03-zama-init-end-to-end
plan: 06
type: execute
wave: 3
depends_on: [03-04, 03-05]
files_modified:
  - plugins/zama-skills/skills/init/scripts/lib/pin-resolver.test.ts
  - plugins/zama-skills/skills/init/scripts/preflight.test.ts
  - plugins/zama-skills/skills/init/scripts/closing-summary.test.ts
  - plugins/zama-skills/skills/init/scripts/scaffold.test.ts
  - tests/integration/zama-init-smoke.test.ts
autonomous: true
requirements: [INIT-06]
must_haves:
  truths:
    - "Unit tests cover pin-resolver edge cases (unknown pin throws, solc special case, alias keys)"
    - "Unit tests cover preflight branches (Node fail, pnpm fail, network fail) with mocked deps"
    - "Unit tests cover closing-summary substitution + appended tail lines"
    - "Unit tests cover scaffold's --post-grep mode with synthetic deprecated/clean fixtures"
    - "Integration smoke scaffolds confidential-token into a temp dir and asserts pnpm hardhat compile exits 0"
    - "Integration smoke is opt-in (skipped by default in CI; runs locally via `pnpm test:smoke`)"
  artifacts:
    - path: "plugins/zama-skills/skills/init/scripts/scaffold.test.ts"
      provides: "Vitest unit + filesystem-mocked behavior tests"
      contains: "describe"
    - path: "tests/integration/zama-init-smoke.test.ts"
      provides: "Real-world end-to-end smoke harness"
      contains: "hardhat compile"
  key_links:
    - from: "scaffold.test.ts"
      to: "scaffold.ts (03-04)"
      via: "import"
      pattern: "from.*scaffold"
    - from: "tests/integration/zama-init-smoke.test.ts"
      to: "scripts/scaffold.ts"
      via: "spawn tsx scaffold.ts ... --target <tmpdir>"
      pattern: "spawn|execa"
---

<objective>
Test the runtime helpers and prove the end-to-end compile-green guarantee.

Purpose: INIT-06 is "manual smoke test: clean dir → pnpm install → pnpm hardhat compile green". This plan automates that smoke (so it's reproducible) plus adds vitest unit coverage for the moving parts.
Output: 4 unit-test files (vitest, colocated next to the .ts files they test) + 1 integration smoke test under `tests/integration/`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-zama-init-end-to-end/03-CONTEXT.md
@.planning/phases/03-zama-init-end-to-end/ORCHESTRATION.md
@scripts/lib/versions.test.ts
@scripts/lib/markers.test.ts

<interfaces>
- Vitest is already a repo devDep (Phase 1).
- Use `node:fs/promises` + `node:os.tmpdir()` + `crypto.randomUUID()` for temp dirs.
- For mocking pnpm/network/Node version in preflight.test.ts: use `vi.spyOn(process, "versions", "get")` won't work; instead refactor preflight to inject deps OR use vitest's `vi.hoisted` + module mocks.
  - Recommended: design preflight to take `opts: { execPnpm?: () => Promise<{ok: boolean}>; checkNetwork?: () => Promise<boolean>; nodeVersion?: string }` — defaults wired to real impls. Tests pass mock fns. (This will require a small revision to 03-05 — call this out in the SUMMARY.)
- Smoke test has a long timeout (vitest `testTimeout: 300_000`).
- Smoke test gated by env var `ZAMA_INIT_SMOKE=1` so CI default is skipped.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Unit tests for pin-resolver, preflight, closing-summary</name>
  <files>
    plugins/zama-skills/skills/init/scripts/lib/pin-resolver.test.ts,
    plugins/zama-skills/skills/init/scripts/preflight.test.ts,
    plugins/zama-skills/skills/init/scripts/closing-summary.test.ts
  </files>
  <action>
**`pin-resolver.test.ts`** — pure function tests:
- `resolvePins("foo <!-- @pin:hardhat --> bar", deps)` → contains version from `getVersion("hardhat")`.
- `<!-- @pin:solc -->` → uses `getCompilerVersion()`, not `getVersion`.
- Unknown pin → throws with message containing the unknown key.
- Multiple pins in one string → all replaced; `pins` record contains all keys.
- No pins in string → returns text unchanged + empty `pins` record.

**`preflight.test.ts`** — uses the inject-deps shape from interfaces above:
- Node 20.10.0 + pnpm OK + network OK → `ok: true`.
- Node 18.x → `ok: false`, failures contains "Node 20+".
- Node 22 OK + pnpm fails → failures contains "pnpm not found".
- All OK but `skipNetwork: true` → ok: true, network not called.
- Network timeout simulated → failures contains "registry".

**`closing-summary.test.ts`** — uses a tmp dir with stub `closing-summary.md` / `sepolia-faucet.md` / `versions-table.md` content:
- Renders MetaMask deep-link line (`chainid.network/?search=sepolia`).
- Renders context7 reassurance line.
- Substitutes `{{SKILL_NAME}}` → `/zama-init`.
- Substitutes `{{NEXT_SKILL}}` based on use-case (token vs voting differ in `NEXT_SKILL_REASON`).
- Renders bullet list grouped by top-level dir.
- Caps file list at ~30 with "(+N more)" suffix.

All three test files use vitest `describe` / `it` / `expect`. No CLI invocation here — direct function calls only.
  </action>
  <verify>
    <automated>
      test -f plugins/zama-skills/skills/init/scripts/lib/pin-resolver.test.ts && \
      test -f plugins/zama-skills/skills/init/scripts/preflight.test.ts && \
      test -f plugins/zama-skills/skills/init/scripts/closing-summary.test.ts && \
      pnpm exec vitest run plugins/zama-skills/skills/init/scripts/
    </automated>
  </verify>
  <done>3 unit-test files exist, vitest run reports all green, branches covered as documented.</done>
</task>

<task type="auto">
  <name>Task 2: scaffold.ts unit tests + integration smoke harness</name>
  <files>
    plugins/zama-skills/skills/init/scripts/scaffold.test.ts,
    tests/integration/zama-init-smoke.test.ts
  </files>
  <action>
**`scaffold.test.ts`** (unit-level, no real install/compile — uses `--no-install --no-compile`):
- Scaffolds `confidential-token` into a tmpdir; asserts:
  - `<tmp>/package.json` exists, contains the resolved version of `typescript`
  - `<tmp>/packages/contracts/package.json` exists, contains resolved `@fhevm/solidity` version (no `@pin:` strings remain)
  - `<tmp>/packages/contracts/contracts/Token.sol` exists (seed copied)
  - `<tmp>/.env.example` exists, contains `INFURA_API_KEY`
  - `<tmp>/.gitignore` exists, contains `.env`
- Scaffolding when target dir non-empty without `--force` → exits non-zero.
- `--post-grep` against a synthetic dir containing a file with `import 'fhevmjs'` → exits 1, stdout JSON has `ok: false` + matches.
- `--post-grep` against a clean dir → exits 0.
- Recursive grep ignores comment lines (write fixture: `// fhevmjs` only — should NOT trigger).
- Each test cleans up its tmp dir in `afterEach`.

**`tests/integration/zama-init-smoke.test.ts`** (real install + compile, gated):
```ts
import { describe, it, expect } from "vitest";
const SMOKE = process.env.ZAMA_INIT_SMOKE === "1";
describe.skipIf(!SMOKE)("zama-init smoke", () => {
  it("scaffolds confidential-token and compiles green", async () => {
    // 1. mkdtemp under os.tmpdir()
    // 2. spawn `pnpm exec tsx <plugin>/skills/init/scripts/scaffold.ts --use-case confidential-token --target <tmp>` (NO --no-install/--no-compile)
    // 3. capture stdout (JSON manifest), parse, assert manifest.commandsRan contains both 'pnpm install' and 'pnpm hardhat compile' with ok:true
    // 4. assert manifest.deprecationGrep.ok === true
  }, { timeout: 600_000 });
});
```
- Add `pnpm test:smoke` script to root `package.json` that sets `ZAMA_INIT_SMOKE=1` and runs vitest only on `tests/integration/`.
- Document in SUMMARY: this test is heavy (full pnpm install + Hardhat compile, ~3-5 min on cold cache). NOT run in default CI; required-pass before submission (Phase 6 release-checklist gate).
  </action>
  <verify>
    <automated>
      test -f plugins/zama-skills/skills/init/scripts/scaffold.test.ts && \
      test -f tests/integration/zama-init-smoke.test.ts && \
      grep -q "ZAMA_INIT_SMOKE" tests/integration/zama-init-smoke.test.ts && \
      grep -q "skipIf" tests/integration/zama-init-smoke.test.ts && \
      pnpm exec vitest run plugins/zama-skills/skills/init/scripts/scaffold.test.ts && \
      grep -q '"test:smoke"' package.json
    </automated>
  </verify>
  <done>Unit scaffold tests pass on default vitest run; smoke test exists but skipped unless ZAMA_INIT_SMOKE=1; pnpm test:smoke script wired.</done>
</task>

</tasks>

<verification>
- 5 test files total (4 unit + 1 integration).
- Default `pnpm test` covers the 4 unit files; smoke is opt-in.
- pin-resolver, preflight, closing-summary, scaffold post-grep all green.
- INIT-06 manual smoke is now reproducible via one command.
</verification>

<success_criteria>
- INIT-06 — `pnpm test:smoke` (with `ZAMA_INIT_SMOKE=1`) ends with green Hardhat compile in a fresh dir; no deprecation hits.
- Unit coverage prevents regression in pin-resolution and post-grep without paying the multi-minute install cost.
</success_criteria>

<output>
After completion, create `.planning/phases/03-zama-init-end-to-end/03-06-SUMMARY.md` documenting: test inventory, the preflight DI refactor (called out in interfaces), the smoke gate, and approximate smoke runtime so Phase 6 release checklist can budget.
</output>
