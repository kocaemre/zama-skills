---
phase: 04-other-4-skills
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - plugins/zama-skills/skills/deploy/SKILL.md
  - plugins/zama-skills/skills/deploy/scripts/deploy.ts
  - plugins/zama-skills/skills/deploy/scripts/lib/env-validate.ts
  - plugins/zama-skills/skills/deploy/scripts/lib/sepolia-addresses.ts
  - plugins/zama-skills/skills/deploy/scripts/lib/abi-export.ts
  - plugins/zama-skills/skills/deploy/scripts/lib/preflight.ts
  - plugins/zama-skills/skills/deploy/assets/templates/deploy.ts.tpl
  - plugins/zama-skills/skills/deploy/assets/templates/register-token.ts.tpl
  - plugins/zama-skills/skills/deploy/scripts/deploy.test.ts
autonomous: false
requirements: [DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05]
must_haves:
  truths:
    - "/zama-deploy skill has `disable-model-invocation: true` — only user can trigger (DEPLOY-05)"
    - "Step 1: env-validate checks SEPOLIA_RPC_URL, MNEMONIC (or PRIVATE_KEY), ETHERSCAN_API_KEY (DEPLOY-04)"
    - "Step 2: pnpm hardhat compile"
    - "Step 3: deploy to Sepolia, capture address"
    - "Step 4: hardhat verify on Etherscan (DEPLOY-01)"
    - "Step 5: if confidential-token detected, register with Confidential Token Registry (DEPLOY-02)"
    - "Step 6: ABI export to packages/frontend/src/abis/<Name>.json"
    - "Step 7: closing summary with deployed address, Etherscan URL, frontend env reminder"
    - "Sepolia ACL/KMS/Coprocessor/Registry addresses fetched LIVE via WebFetch (not pinned in source) with 24h cache (DEPLOY-03)"
    - "Skill never deploys to mainnet — chainId hard-checked"
    - "Skill aborts before any tx if .env missing required vars; lists exact missing names"
  artifacts:
    - path: "plugins/zama-skills/skills/deploy/SKILL.md"
      provides: "7-step skill body with disable-model-invocation: true and confirm-before-deploy block"
      contains: "disable-model-invocation: true"
    - path: "plugins/zama-skills/skills/deploy/scripts/deploy.ts"
      provides: "Orchestrator running 7 steps"
      exports: ["runDeploy"]
    - path: "plugins/zama-skills/skills/deploy/scripts/lib/env-validate.ts"
      provides: "Strict env var check; named-missing list"
      exports: ["validateEnv", "REQUIRED_ENV"]
    - path: "plugins/zama-skills/skills/deploy/scripts/lib/sepolia-addresses.ts"
      provides: "WebFetch-backed Zama Sepolia address registry with 24h cache to .cache/zama-addresses.json"
      exports: ["getSepoliaAddresses"]
    - path: "plugins/zama-skills/skills/deploy/scripts/lib/abi-export.ts"
      provides: "Read artifacts/, write packages/frontend/src/abis/<Name>.json"
      exports: ["exportAbi"]
    - path: "plugins/zama-skills/skills/deploy/assets/templates/deploy.ts.tpl"
      provides: "hardhat-deploy script template with constructor-arg placeholder"
    - path: "plugins/zama-skills/skills/deploy/assets/templates/register-token.ts.tpl"
      provides: "Confidential Token Registry registration script (Sepolia)"
      contains: "registerToken"
  key_links:
    - from: "deploy.ts"
      to: "env-validate.ts"
      via: "validateEnv() invoked first; abort with named missing vars"
      pattern: "validateEnv"
    - from: "deploy.ts"
      to: "sepolia-addresses.ts"
      via: "getSepoliaAddresses() before token registry call"
      pattern: "getSepoliaAddresses"
    - from: "deploy.ts"
      to: "abi-export.ts"
      via: "exportAbi(name) after successful verify"
      pattern: "exportAbi"
---

<objective>
Author the `/zama-deploy` skill: 7-step Sepolia deploy flow with strict env validation, live address fetch (no pinning), Etherscan verify, optional Confidential Token Registry registration, ABI export to the frontend, and closing summary. Skill is `disable-model-invocation: true` — user must explicitly invoke.

Purpose: Implements all 5 DEPLOY-* requirements. The strict env-validation + live address fetch + chain-id hard-check are the safety net preventing mainnet-by-mistake and stale-address bugs.
Output: Working `/zama-deploy` skill that takes a fresh contract from `/zama-contract` to a verified, registered, frontend-wired Sepolia deployment.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/phases/04-other-4-skills/04-CONTEXT.md
@CLAUDE.md
@plugins/zama-skills/skills/deploy/SKILL.md
@plugins/zama-skills/shared/pinned-versions.json
@plugins/zama-skills/skills/init/scripts/scaffold.ts

<interfaces>
- REQUIRED_ENV: ['SEPOLIA_RPC_URL', 'ETHERSCAN_API_KEY']; one of ['MNEMONIC', 'PRIVATE_KEY'] required.
- Sepolia chain id: 11155111 (hard-checked before sending any tx).
- WebFetch URL: `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia`
- Cache file: `.cache/zama-addresses.json` with shape:
  ```json
  { "fetchedAt": "2026-05-03T12:00:00Z", "ttlHours": 24, "addresses": { "ACL": "0x...", "KMSVerifier": "0x...", "InputVerifier": "0x...", "FHEVMExecutor": "0x...", "DecryptionOracle": "0x...", "ConfidentialTokenRegistry": "0x..." } }
  ```
- ABI export: read `artifacts/contracts/<Name>.sol/<Name>.json`, write `{ abi, bytecode, address, network: 'sepolia' }` to `packages/frontend/src/abis/<Name>.json`.
- hardhat verify command: `pnpm hardhat verify --network sepolia <address> <constructorArgs...>`.
- Confidential Token Registry trigger: skill detects ERC7984 base by `grep -l 'is ERC7984' packages/contracts/contracts/<Name>.sol`; if positive, runs registration template.
- ethers v6, hardhat 2.28.4, @nomicfoundation/hardhat-verify 2.1.3 — pinned via shared/pinned-versions.json.
- Closing summary fields: name, address (clickable Etherscan link `https://sepolia.etherscan.io/address/<addr>`), tx hash, registry tx hash (if applicable), abi path, frontend env reminder for `VITE_<NAME>_ADDRESS`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author SKILL.md with disable-model-invocation</name>
  <files>plugins/zama-skills/skills/deploy/SKILL.md</files>
  <action>
1. Frontmatter MUST include:
   - `disable-model-invocation: true`
   - `allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, WebFetch]`

2. Workflow body — explicit 7 steps in order. Each step describes what runs and the abort condition.

3. **STEP 0 — Confirmation prompt** (always): Display contract name, target chain `Sepolia (11155111)`, deployer address (read from .env preview). AskUserQuestion to confirm. STOP if user says no.

4. **STEP 1 — env-validate**: Bash `${CLAUDE_SKILL_DIR}/scripts/lib/env-validate.ts`. On failure: print named missing list, STOP.

5. **STEP 2 — Compile**: Bash `pnpm hardhat compile`. Abort on non-zero.

6. **STEP 3 — Deploy**: Bash `pnpm hardhat run --network sepolia scripts/deploy/<Name>.ts` (or use deploy.ts orchestrator). Capture deployed address.

7. **STEP 4 — Verify**: Bash hardhat verify. Retry once on rate limit. Skip with warning if API down.

8. **STEP 5 — Token Registry (conditional)**: If ERC7984 detected, fetch registry address via `${CLAUDE_SKILL_DIR}/scripts/lib/sepolia-addresses.ts`, then Bash registration script.

9. **STEP 6 — ABI export**: Bash `${CLAUDE_SKILL_DIR}/scripts/lib/abi-export.ts <Name>`.

10. **STEP 7 — Closing summary**: print fields per <interfaces>; reminder line: "Update `packages/frontend/.env` with `VITE_<NAME>_ADDRESS=<address>`. Next: run /zama-frontend to wire UI hooks."

11. Insert "ABORT-IF-MAINNET" callout: if `network.name !== 'sepolia'` or chainId !== 11155111, refuse.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'); const s=fs.readFileSync('plugins/zama-skills/skills/deploy/SKILL.md','utf8'); if (!s.includes('disable-model-invocation: true')) { console.error('missing disable-model-invocation'); process.exit(1); } for (const m of ['Step 0','Step 7','env-validate','sepolia-addresses','abi-export','/zama-frontend']) if (!s.toLowerCase().includes(m.toLowerCase())) { console.error('missing:',m); process.exit(1); }"</automated>
  </verify>
  <done>SKILL.md has disable-model-invocation: true, 7-step body, confirmation gate, mainnet-abort callout, "next: /zama-frontend" closing line.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement env-validate + sepolia-addresses + abi-export + preflight</name>
  <files>plugins/zama-skills/skills/deploy/scripts/lib/env-validate.ts, plugins/zama-skills/skills/deploy/scripts/lib/sepolia-addresses.ts, plugins/zama-skills/skills/deploy/scripts/lib/abi-export.ts, plugins/zama-skills/skills/deploy/scripts/lib/preflight.ts, plugins/zama-skills/skills/deploy/scripts/deploy.test.ts</files>
  <behavior>
    - env-validate: missing SEPOLIA_RPC_URL → returns { ok: false, missing: ['SEPOLIA_RPC_URL'] }
    - env-validate: has only PRIVATE_KEY (no MNEMONIC) → ok
    - env-validate: missing both PRIVATE_KEY and MNEMONIC → missing: ['MNEMONIC|PRIVATE_KEY']
    - sepolia-addresses: cold fetch → calls WebFetch (mocked in tests), writes .cache/zama-addresses.json
    - sepolia-addresses: warm cache <24h → returns cached without WebFetch
    - sepolia-addresses: stale cache (>24h or missing TTL) → refetches
    - sepolia-addresses: WebFetch fails on cold → throws with actionable message
    - abi-export: reads artifacts/contracts/Counter.sol/Counter.json, writes packages/frontend/src/abis/Counter.json with {abi, bytecode, address, network}
    - abi-export: missing artifact → throws "run pnpm hardhat compile first"
    - preflight: chainId !== 11155111 → returns "ABORT: not Sepolia"
  </behavior>
  <action>
1. `env-validate.ts`:
   - Export `REQUIRED_ENV = ['SEPOLIA_RPC_URL', 'ETHERSCAN_API_KEY']` and `EITHER_ENV = [['MNEMONIC', 'PRIVATE_KEY']]`.
   - Export `validateEnv(env: Record<string,string|undefined>): { ok: boolean; missing: string[] }`.
   - CLI mode: load `.env` via dotenv, run check, exit non-zero with named-missing list if invalid.

2. `sepolia-addresses.ts`:
   - Export `async function getSepoliaAddresses(): Promise<Addresses>`.
   - Read `.cache/zama-addresses.json` if present; if `Date.now() - fetchedAt < ttl` return cached.
   - Otherwise call `WebFetch` (in skill runtime; in tests, inject a mock fetch via DI param).
   - Parse the docs page for ACL/KMSVerifier/InputVerifier/FHEVMExecutor/DecryptionOracle/ConfidentialTokenRegistry addresses (hex match `0x[a-fA-F0-9]{40}` near each label).
   - Write back to cache.
   - The actual WebFetch invocation is performed by the skill body (Claude); this module exposes a parser fn `parseAddressesFromHtml(html: string)` for tests.

3. `abi-export.ts`:
   - Export `exportAbi(name: string, address: string): string` returning the written path.
   - Reads `artifacts/contracts/<name>.sol/<name>.json` (Hardhat artifact format).
   - Writes `packages/frontend/src/abis/<Name>.json` with `{ abi, bytecode, address, network: 'sepolia' }`.

4. `preflight.ts`:
   - Workspace detect (`packages/contracts/`).
   - Chain-id check via `pnpm hardhat console --network sepolia` is too heavy — instead read `hardhat.config.ts` for the sepolia network's chainId; refuse if mismatch.
   - Refuses if `package.json` shows hardhat ^3 or ethers ^5.

5. vitest cases for all behaviors above. Mock fetch for sepolia-addresses; use temp fs for cache + abi-export.
  </action>
  <verify>
    <automated>pnpm vitest run plugins/zama-skills/skills/deploy/scripts/deploy.test.ts</automated>
  </verify>
  <done>vitest green for all behaviors; cache file is created on cold path; addresses parser extracts the 6 expected fields from a sample fixture HTML.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Implement deploy.ts orchestrator + 2 templates</name>
  <files>plugins/zama-skills/skills/deploy/scripts/deploy.ts, plugins/zama-skills/skills/deploy/assets/templates/deploy.ts.tpl, plugins/zama-skills/skills/deploy/assets/templates/register-token.ts.tpl</files>
  <behavior>
    - runDeploy({contract:"Counter", args:[]}) → invokes 7 steps in order, prints summary
    - runDeploy with missing env → exits at step 1 with named-missing list, never compiles
    - runDeploy on a contract whose source contains "is ERC7984" → step 5 runs registration; otherwise skipped
    - chainId !== 11155111 → exits at step 0 with "ABORT: not Sepolia"
    - Generated deploy.ts.tpl produces a script that uses ethers v6 (no BigNumber.from)
    - register-token.ts.tpl uses sepolia-addresses to look up registry address (no pinned hex)
  </behavior>
  <action>
1. `deploy.ts`:
   - Read CLI args: `--contract <Name> [--args ...]`.
   - Run 7 steps with strict ordering; print step header before each.
   - Use child_process.execSync for hardhat invocations; capture deployed address from stdout (regex `Deployed at: (0x[a-fA-F0-9]{40})`).
   - Pass deployed address to abi-export and registration steps.
   - Step 5 detection: read source, grep `is ERC7984`.
   - Final closing summary printed to stdout per <interfaces>.

2. `deploy.ts.tpl` (script template materialized into `scripts/deploy/<Name>.ts` of user's project):
   - Imports from `hardhat` (ethers v6).
   - Reads constructor args from a `<Name>.args.ts` adjacent file if present; else `[]`.
   - Deploys, prints `Deployed at: <addr>` on stdout.

3. `register-token.ts.tpl`:
   - Loads registry address via getSepoliaAddresses (calls into the skill's own helper at runtime, OR uses an env var `ZAMA_TOKEN_REGISTRY` populated by the skill before invocation).
   - Calls `IConfidentialTokenRegistry.register(tokenAddress)` on Sepolia.
   - Prints registration tx hash.

4. vitest cases stubbing execSync; verify orchestration order and short-circuit on env failure.
  </action>
  <verify>
    <automated>pnpm vitest run plugins/zama-skills/skills/deploy/scripts/deploy.test.ts -t orchestrator</automated>
  </verify>
  <done>vitest green; manual smoke (with real Sepolia env) deploys + verifies + exports ABI; non-ERC7984 contracts skip step 5; mainnet attempt aborts.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User .env → deploy script | Untrusted but local-only |
| Skill → Sepolia (real network) | Real (test) value at risk if mistakes go to mainnet |
| WebFetch → Zama docs | Address registry source of truth; HTTPS, but parse must be robust |
| Skill → Etherscan API | Public, rate-limited |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-12 | Elevation of Privilege | Auto-deploy without user confirmation | mitigate | `disable-model-invocation: true` + Step 0 confirmation prompt (Task 1) |
| T-04-13 | Tampering | Mainnet deploy by mistake | mitigate | chainId hard-check 11155111 in preflight + deploy.ts; refuses anything else (Task 2, 3) |
| T-04-14 | Information Disclosure | .env secrets in commit | accept | /zama-init .env.example only; .env is .gitignored already |
| T-04-15 | Tampering | Stale Sepolia addresses cached | mitigate | 24h TTL + refetch on stale (Task 2) |
| T-04-16 | Spoofing | Tampered registry address | mitigate | Source = Zama docs over HTTPS; parser anchored to labels; manual review of cache file possible |
| T-04-17 | Denial of Service | Etherscan rate limit | accept | Verify failure prints warning, doesn't block deploy success |
| T-04-18 | Tampering | Skill silently downloads new package versions | mitigate | All deps pinned via shared/pinned-versions.json; skill never runs `pnpm add` |
</threat_model>

<verification>
1. `pnpm vitest run plugins/zama-skills/skills/deploy/` green
2. Manual smoke (user-driven, requires Sepolia faucet ETH):
   - Run on a Counter.sol (standalone): expect deploy → verify → ABI export → step 5 skipped → closing summary
   - Run on an ERC7984 token: expect step 5 to run; tx hash printed
3. Negative: run with empty .env → step 1 aborts with named missing list, no compile invoked
4. Negative: tamper hardhat.config.ts to point sepolia to chainId 1 → preflight aborts
</verification>

<success_criteria>
- All 5 DEPLOY-* requirements satisfied
- disable-model-invocation: true present
- 0 pinned Sepolia addresses in repo source (only in `.cache/zama-addresses.json`, which is gitignored)
- Cache TTL behavior verified
- Mainnet abort verified
</success_criteria>

<output>
Create `.planning/phases/04-other-4-skills/04-03-SUMMARY.md` with: env vars enforced, address registry parser hits, sample deployed address (if user smoke-tested), ABI export path, vitest summary.
</output>
