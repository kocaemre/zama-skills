---
phase: 05-reference-example-dapp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - examples/confidential-token/.gitignore
  - examples/confidential-token/.gsd-snapshot.json
  - examples/confidential-token/packages/contracts/contracts/Token.sol
  - examples/confidential-token/packages/contracts/hardhat.config.ts
  - examples/confidential-token/packages/contracts/package.json
  - examples/confidential-token/packages/contracts/test/Token.spec.ts
  - examples/confidential-token/packages/contracts/test/Token.sepolia.spec.ts
  - examples/confidential-token/packages/contracts/scripts/deploy.ts
  - examples/confidential-token/packages/frontend/src/lib/fhe.ts
  - examples/confidential-token/packages/frontend/src/hooks/useDecrypted.ts
  - examples/confidential-token/packages/frontend/src/components/EncryptedInput.tsx
  - examples/confidential-token/packages/frontend/package.json
autonomous: true
requirements: [EXAMPLE-01, EXAMPLE-04]
must_haves:
  truths:
    - "examples/confidential-token/ exists and was produced by running the actual /zama-* skills against an empty dir"
    - "Generated Token.sol extends ERC7984 from @openzeppelin/confidential-contracts and has SepoliaConfig"
    - "All four skills (/zama-init, /zama-contract, /zama-test, /zama-frontend) ran without modification"
    - "Skill output is committed verbatim before any hand-curation in later plans"
    - ".gsd-snapshot.json captures skill versions + use-case + timestamp + skill commit SHAs"
    - "No deprecated imports (fhevmjs, fhevm root) appear anywhere in scaffolded files"
  artifacts:
    - path: "examples/confidential-token/.gsd-snapshot.json"
      provides: "Provenance record for EXAMPLE-04"
      contains: "skill_versions"
    - path: "examples/confidential-token/packages/contracts/contracts/Token.sol"
      provides: "ERC7984 token contract produced by /zama-contract"
      contains: "ERC7984"
    - path: "examples/confidential-token/packages/contracts/test/Token.spec.ts"
      provides: "Mock test produced by /zama-test"
      contains: "describe"
    - path: "examples/confidential-token/packages/frontend/src/lib/fhe.ts"
      provides: "Relayer-SDK wiring produced by /zama-frontend"
      contains: "@zama-fhe/relayer-sdk"
  key_links:
    - from: "examples/confidential-token/.gsd-snapshot.json"
      to: "plugins/zama-skills/shared/pinned-versions.json"
      via: "skill_versions field mirrors pinned versions at scaffold time"
      pattern: "skill_versions"
---

<objective>
Dogfood the Zama skills by running `/zama-init`, `/zama-contract`, `/zama-test`, `/zama-frontend` against a fresh `examples/confidential-token/` directory. Commit the raw skill output verbatim — this proves EXAMPLE-01 (the example IS skill output) and produces the baseline that later plans hand-curate on top of. Write `.gsd-snapshot.json` capturing skill versions and the use-case used to seed the run for EXAMPLE-04.

Purpose: Without this, every later plan is hand-written and EXAMPLE-01 is unprovable.
Output: A skill-generated, untouched scaffold + provenance JSON, all in one atomic commit so CI smoke-diff (Plan 06) has a clean baseline.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/phases/05-reference-example-dapp/05-CONTEXT.md
@CLAUDE.md
@plugins/zama-skills/skills/init/SKILL.md
@plugins/zama-skills/skills/contract/SKILL.md
@plugins/zama-skills/skills/test/SKILL.md
@plugins/zama-skills/skills/frontend/SKILL.md
@plugins/zama-skills/shared/pinned-versions.json
@.planning/phases/04-other-4-skills/04-04-SUMMARY.md

<interfaces>
Locked use-case (passed to /zama-contract):
```json
{
  "name": "Token",
  "base": "erc7984",
  "schema": [],
  "decryptionPath": "user",
  "metadata": {
    "name": "Confidential Demo Token",
    "symbol": "cDEMO",
    "decimals": 6
  }
}
```

`.gsd-snapshot.json` schema (single source for EXAMPLE-04):
```json
{
  "version": 1,
  "created_at": "<ISO-8601>",
  "use_case": "erc7984-confidential-token",
  "skill_versions": {
    "init":     "<commit SHA from plugins/zama-skills/skills/init/>",
    "contract": "<commit SHA from plugins/zama-skills/skills/contract/>",
    "test":     "<commit SHA from plugins/zama-skills/skills/test/>",
    "deploy":   "<commit SHA from plugins/zama-skills/skills/deploy/>",
    "frontend": "<commit SHA from plugins/zama-skills/skills/frontend/>"
  },
  "pinned_versions_sha": "<sha256 of plugins/zama-skills/shared/pinned-versions.json>",
  "scaffold_inputs": {
    "contract_name": "Token",
    "base": "erc7984",
    "decryption_path": "user",
    "with_wagmi": true
  },
  "skill_invocation_order": ["zama-init", "zama-contract", "zama-test", "zama-frontend"]
}
```

Output layout (matches the layouts each skill produces):
```
examples/confidential-token/
  .gitignore                       # node_modules, .env*, dist, .next, etc.
  .gsd-snapshot.json
  package.json                     # workspace root from /zama-init
  packages/
    contracts/                     # /zama-init + /zama-contract + /zama-test
      contracts/Token.sol
      hardhat.config.ts
      package.json
      test/Token.spec.ts
      test/Token.sepolia.spec.ts
      scripts/deploy.ts            # placeholder; Plan 04 replaces
    frontend/                      # /zama-init + /zama-frontend
      src/lib/fhe.ts
      src/hooks/useDecrypted.ts
      src/components/EncryptedInput.tsx
      package.json
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold via /zama-init + /zama-contract + /zama-test + /zama-frontend</name>
  <files>examples/confidential-token/**</files>
  <action>
1. Create empty `examples/confidential-token/` (and add to root `.gitignore` ONLY for nested `node_modules`, never the source).
2. From inside `examples/confidential-token/`:
   - Run `/zama-init` with workspace name `confidential-token`, type `monorepo (contracts + frontend)`, package manager `pnpm`. Accept the scaffold verbatim — do NOT hand-edit.
   - Run `/zama-contract` with inputs from `<interfaces>` (name=Token, base=erc7984, decryptionPath=user). The skill will produce `packages/contracts/contracts/Token.sol` extending OZ ERC7984 with SepoliaConfig.
   - Run `/zama-test` for the `Token` contract — produces both `Token.spec.ts` (mock) and `Token.sepolia.spec.ts`.
   - Run `/zama-frontend` with `withWagmi=true`, contract path `packages/contracts/contracts/Token.sol` — produces `packages/frontend/src/lib/fhe.ts` (wagmi variant), `useDecrypted.ts`, `EncryptedInput.tsx`.
3. Do NOT run `/zama-deploy` here — Plan 04 owns deploy.
4. Add `examples/confidential-token/.gitignore` with: `node_modules/`, `.env`, `.env.local`, `.env.deploy.local`, `dist/`, `.next/`, `out/`, `coverage/`, `cache/`, `artifacts/`, `typechain-types/`, `deployments/localhost/`.
5. Commit message: `chore(05): scaffold examples/confidential-token via /zama-* skills`.

CRITICAL: If any skill output looks "wrong", FIX THE SKILL in a separate plan/PR — do NOT hand-edit the scaffold. EXAMPLE-01 requires the example to be skill output.
  </action>
  <verify>
    <automated>test -f examples/confidential-token/packages/contracts/contracts/Token.sol && test -f examples/confidential-token/packages/frontend/src/lib/fhe.ts && test -f examples/confidential-token/packages/contracts/test/Token.spec.ts && grep -q ERC7984 examples/confidential-token/packages/contracts/contracts/Token.sol && grep -q '@zama-fhe/relayer-sdk' examples/confidential-token/packages/frontend/src/lib/fhe.ts && ! grep -RIn --include='*.ts' --include='*.tsx' --include='*.sol' --include='*.json' -E "(^|[^a-zA-Z0-9_])(fhevmjs|\"fhevm\")" examples/confidential-token/</automated>
  </verify>
  <done>Workspace exists with contracts + frontend packages; Token.sol extends ERC7984; fhe.ts imports relayer-sdk; no deprecated imports anywhere; everything came from skill output (not hand-typed).</done>
</task>

<task type="auto">
  <name>Task 2: Write .gsd-snapshot.json + verify install/compile</name>
  <files>examples/confidential-token/.gsd-snapshot.json, examples/confidential-token/scripts/snapshot.mjs</files>
  <action>
1. Create `examples/confidential-token/scripts/snapshot.mjs` (small Node script) that:
   - Reads commit SHAs of each skill dir via `git log -1 --format=%H -- plugins/zama-skills/skills/<name>/`.
   - Computes sha256 of `plugins/zama-skills/shared/pinned-versions.json`.
   - Writes `.gsd-snapshot.json` per the schema in `<interfaces>`.
   - Idempotent: re-running updates `created_at` only if `--touch` flag passed; default mode preserves existing values to make snapshot stable for CI smoke-diff.
2. Run `node scripts/snapshot.mjs` from the example dir to produce the file.
3. From `examples/confidential-token/` run `pnpm install` then `pnpm --filter contracts hardhat compile`. Compile must exit 0. (Frontend install only — no `pnpm dev` here; that's Plan 02.)
4. Commit: `chore(05): add .gsd-snapshot.json + verify scaffold compiles`.
  </action>
  <verify>
    <automated>cd examples/confidential-token && node -e "const j=require('./.gsd-snapshot.json'); for (const k of ['init','contract','test','deploy','frontend']) if (!j.skill_versions[k]) { console.error('missing skill version:',k); process.exit(1); } if (j.use_case !== 'erc7984-confidential-token') process.exit(2);" && pnpm --filter contracts hardhat compile</automated>
  </verify>
  <done>.gsd-snapshot.json present with all 5 skill SHAs + pinned-versions hash; `pnpm hardhat compile` exits 0; both commits landed.</done>
</task>

</tasks>

<verification>
1. `examples/confidential-token/` is committed via two atomic commits (scaffold, then snapshot+compile).
2. Every file under the example dir was either generated by a skill or is the snapshot/gitignore — no hand-written contract or frontend code yet.
3. `grep -RE "fhevmjs|\"fhevm\"" examples/confidential-token/` returns nothing.
4. `pnpm --filter contracts hardhat compile` passes.
</verification>

<success_criteria>
- EXAMPLE-01 baseline established (skill-produced scaffold)
- EXAMPLE-04 satisfied (.gsd-snapshot.json exists with required fields)
- Zero deprecated imports
- Hardhat compile green
- Plan 02 can now build the Next.js shell on top of /zama-frontend's lib output
</success_criteria>

<output>
Create `.planning/phases/05-reference-example-dapp/05-01-SUMMARY.md` listing: skill SHAs captured, scaffold file count, contract compile status, any skill bugs surfaced (with separate issue links if found).
</output>
