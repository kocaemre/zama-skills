---
phase: 04-other-4-skills
plan: 05
type: execute
wave: 1
depends_on: []
files_modified:
  - plugins/zama-skills/skills/_lib/preflight-shared.ts
  - plugins/zama-skills/skills/_lib/closing-summary.ts
  - plugins/zama-skills/shared/prompts/closing-summary-contract.md
  - plugins/zama-skills/shared/prompts/closing-summary-test.md
  - plugins/zama-skills/shared/prompts/closing-summary-deploy.md
  - plugins/zama-skills/shared/prompts/closing-summary-frontend.md
  - plugins/zama-skills/skills/_lib/preflight-shared.test.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "All 4 Phase 4 skills can call a common preflight-shared.ts (workspace detect, pnpm available, package.json parse) so each skill's lib/preflight.ts only adds skill-specific checks"
    - "4 closing-summary fragments exist in shared/prompts/, one per Phase 4 skill, each ending with a 'Next: /zama-<next>' line per CONTEXT chain (contract→test→deploy→frontend→ship)"
    - "Each fragment is referenced via @sync marker in the matching SKILL.md (Phase 2 transclusion engine handles materialization)"
  artifacts:
    - path: "plugins/zama-skills/skills/_lib/preflight-shared.ts"
      provides: "Shared preflight: detectWorkspace(), checkPnpm(), readPkgJson(name)"
      exports: ["detectWorkspace", "checkPnpm", "readPkgJson"]
    - path: "plugins/zama-skills/skills/_lib/closing-summary.ts"
      provides: "Markdown renderer for closing summary fragments with placeholder substitution"
      exports: ["renderClosingSummary"]
    - path: "plugins/zama-skills/shared/prompts/closing-summary-contract.md"
      provides: "Contract skill closing summary template"
      contains: "/zama-test"
    - path: "plugins/zama-skills/shared/prompts/closing-summary-test.md"
      provides: "Test skill closing summary template"
      contains: "/zama-deploy"
    - path: "plugins/zama-skills/shared/prompts/closing-summary-deploy.md"
      provides: "Deploy skill closing summary template"
      contains: "/zama-frontend"
    - path: "plugins/zama-skills/shared/prompts/closing-summary-frontend.md"
      provides: "Frontend skill closing summary template"
      contains: "ship"
  key_links:
    - from: "skills/{contract,test,deploy,frontend}/scripts/lib/preflight.ts"
      to: "skills/_lib/preflight-shared.ts"
      via: "import { detectWorkspace, checkPnpm } from '../../../_lib/preflight-shared'"
      pattern: "preflight-shared"
    - from: "shared/prompts/closing-summary-*.md"
      to: "matching SKILL.md"
      via: "@sync:prompt:closing-summary-<skill> marker"
      pattern: "@sync:prompt:closing-summary-"
---

<objective>
Extract shared logic used by Phase 4's 4 skills into `plugins/zama-skills/skills/_lib/`: a preflight helper (workspace detect, pnpm presence, package.json reader) and a closing-summary renderer with 4 per-skill markdown templates. The "next skill" suggestion chain (contract→test→deploy→frontend→ship) is captured here as the single source of truth.

Purpose: Avoid drift across 4 skills. Each skill's own preflight.ts only handles skill-specific checks (e.g., contract-skill checks `packages/contracts/`; deploy checks chain id; frontend checks typechain v6); the shared part lives once.
Output: 2 TS modules + 4 markdown fragments + tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/phases/04-other-4-skills/04-CONTEXT.md
@plugins/zama-skills/shared/prompts/closing-summary.md
@plugins/zama-skills/scripts/build.ts
@plugins/zama-skills/scripts/lib/

<interfaces>
- preflight-shared API:
  ```ts
  export function detectWorkspace(cwd?: string): { root: string | null; isPnpm: boolean; hasPackagesContracts: boolean; hasPackagesFrontend: boolean };
  export function checkPnpm(): boolean; // tries `pnpm --version`
  export function readPkgJson(absPath: string): { name?: string; version?: string; dependencies?: Record<string,string>; devDependencies?: Record<string,string> } | null;
  ```
- closing-summary API:
  ```ts
  export function renderClosingSummary(skill: 'contract'|'test'|'deploy'|'frontend', vars: Record<string,string>): string;
  ```
  Reads `shared/prompts/closing-summary-<skill>.md` and replaces `{{var}}` placeholders.
- Closing summary fragment chain (per CONTEXT):
  - contract: ends with "Next: run `/zama-test` to generate mock + Sepolia tests for {{name}}."
  - test: ends with "Next: run `/zama-deploy` to ship {{name}} to Sepolia."
  - deploy: ends with "Next: run `/zama-frontend` to wire UI hooks to {{address}}."
  - frontend: ends with "You're ready to ship — `pnpm dev` to preview, then deploy to Vercel."
- The Phase 2 transclusion engine (`scripts/build.ts`) already handles `@sync:prompt:<name>` markers; using `closing-summary-<skill>` follows that convention.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement preflight-shared.ts + closing-summary.ts</name>
  <files>plugins/zama-skills/skills/_lib/preflight-shared.ts, plugins/zama-skills/skills/_lib/closing-summary.ts, plugins/zama-skills/skills/_lib/preflight-shared.test.ts</files>
  <behavior>
    - detectWorkspace in a /zama-init'd dir → { root, isPnpm:true, hasPackagesContracts:true, hasPackagesFrontend:true }
    - detectWorkspace in an empty tmp dir → { root: null, isPnpm:false, hasPackagesContracts:false, hasPackagesFrontend:false }
    - checkPnpm: returns true if `pnpm --version` succeeds, false otherwise (mocked in test)
    - readPkgJson on missing file → null
    - readPkgJson on valid file → returns parsed object
    - renderClosingSummary('contract', {name:'Counter'}) → returns rendered markdown containing 'Counter' and '/zama-test'
    - renderClosingSummary on unknown skill → throws
  </behavior>
  <action>
1. `preflight-shared.ts`:
   - `detectWorkspace`: walks up from cwd looking for `pnpm-workspace.yaml`; returns root and presence flags for `packages/contracts/` + `packages/frontend/`.
   - `checkPnpm`: `execSync('pnpm --version', {stdio:'pipe'})` with try/catch.
   - `readPkgJson`: fs.readFileSync + JSON.parse with try/catch.

2. `closing-summary.ts`:
   - `renderClosingSummary(skill, vars)`: reads `<this-dir>/../../shared/prompts/closing-summary-<skill>.md`, replaces `{{key}}` with `vars[key]` (escape unknown keys → keep as-is for visibility).
   - Path resolution uses `import.meta.url` for ESM compatibility.

3. vitest test cases for all behaviors. Use temp dirs for workspace detection.
  </action>
  <verify>
    <automated>pnpm vitest run plugins/zama-skills/skills/_lib/preflight-shared.test.ts</automated>
  </verify>
  <done>vitest green; both modules exported; closing-summary correctly resolves the per-skill fragment.</done>
</task>

<task type="auto">
  <name>Task 2: Author 4 closing-summary fragments</name>
  <files>plugins/zama-skills/shared/prompts/closing-summary-contract.md, plugins/zama-skills/shared/prompts/closing-summary-test.md, plugins/zama-skills/shared/prompts/closing-summary-deploy.md, plugins/zama-skills/shared/prompts/closing-summary-frontend.md</files>
  <action>
Each fragment uses `{{placeholder}}` syntax for variables.

`closing-summary-contract.md`:
- File written: `{{path}}`
- ACL grants injected: `{{aclCount}}`
- Cleartext-leak patterns refused: 12 (per assertNoCleartextLeak)
- HCU header: present
- Next: run `/zama-test` to generate mock + Sepolia tests for `{{name}}`.

`closing-summary-test.md`:
- Mock test: `{{mockPath}}`
- Sepolia test: `{{sepoliaPath}}`
- ACL re-decrypt assertions: `{{aclAssertCount}}`
- HCU revert risk: noted in sepolia header
- Next: run `/zama-deploy` to ship `{{name}}` to Sepolia.

`closing-summary-deploy.md`:
- Deployed: `{{address}}` ([Etherscan]({{etherscanUrl}}))
- Verification: `{{verifyStatus}}`
- Token Registry: `{{registryStatus}}`
- ABI exported: `{{abiPath}}`
- Frontend env reminder: add `VITE_{{NAME_UPPER}}_ADDRESS={{address}}` to `packages/frontend/.env`
- Next: run `/zama-frontend` to wire UI hooks to `{{address}}`.

`closing-summary-frontend.md`:
- Files generated: `{{libPath}}`, `{{hookPath}}`, `{{componentPath}}`
- 4-state UX: idle → requesting → decrypted → error
- Wagmi shim: `{{withWagmi}}`
- typechain v6: enforced
- Next: `pnpm dev` to preview locally, then deploy to Vercel — you're ready to ship.

Each fragment is plain markdown; the build.ts transclusion engine inlines it where `@sync:prompt:closing-summary-<skill>` markers appear in the matching SKILL.md.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'); for (const s of ['contract','test','deploy','frontend']) { const p='plugins/zama-skills/shared/prompts/closing-summary-'+s+'.md'; const c=fs.readFileSync(p,'utf8'); if (!c.includes('{{')) { console.error('no placeholders in',p); process.exit(1); } if (s==='contract' && !c.includes('/zama-test')) process.exit(2); if (s==='test' && !c.includes('/zama-deploy')) process.exit(3); if (s==='deploy' && !c.includes('/zama-frontend')) process.exit(4); if (s==='frontend' && !c.toLowerCase().includes('ship')) process.exit(5); }"</automated>
  </verify>
  <done>4 fragments exist; chain pointers correct (contract→test→deploy→frontend→ship); placeholders use {{...}} syntax.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Skill → shared/_lib | First-party, no untrusted boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-25 | Tampering | Drift between skills' closing summaries | mitigate | Single source in shared/prompts; @sync materialization (Task 2) |
| T-04-26 | Information Disclosure | placeholder substitution leaks raw fs paths | accept | Paths are project-local; nothing sensitive |
</threat_model>

<verification>
1. `pnpm vitest run plugins/zama-skills/skills/_lib/` green
2. Manual: render each skill's summary with sample vars; verify chain pointers.
</verification>

<success_criteria>
- 2 TS modules + 4 markdown fragments exist
- vitest green
- Chain pointers correct in all 4 fragments
- Phase 4 skills (Plans 01-04) can `import` from `_lib/` and reference `@sync:prompt:closing-summary-*`
</success_criteria>

<output>
Create `.planning/phases/04-other-4-skills/04-05-SUMMARY.md` with: modules + fragments listing, vitest summary, chain verification.
</output>
