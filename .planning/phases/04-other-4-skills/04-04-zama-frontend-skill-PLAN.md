---
phase: 04-other-4-skills
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - plugins/zama-skills/skills/frontend/SKILL.md
  - plugins/zama-skills/skills/frontend/scripts/generate.ts
  - plugins/zama-skills/skills/frontend/scripts/lib/preflight.ts
  - plugins/zama-skills/skills/frontend/assets/templates/fhe.ts.tpl
  - plugins/zama-skills/skills/frontend/assets/templates/useDecrypted.ts.tpl
  - plugins/zama-skills/skills/frontend/assets/templates/EncryptedInput.tsx.tpl
  - plugins/zama-skills/skills/frontend/assets/templates/fhe-wagmi.ts.tpl
  - plugins/zama-skills/skills/frontend/scripts/generate.test.ts
autonomous: true
requirements: [FRONTEND-01, FRONTEND-02, FRONTEND-03, FRONTEND-04]
must_haves:
  truths:
    - "/zama-frontend writes 3 files: src/lib/fhe.ts, src/hooks/useDecrypted.ts, src/components/EncryptedInput.tsx"
    - "fhe.ts uses @zama-fhe/relayer-sdk: await initSDK() + createInstance({...SepoliaConfig, network: window.ethereum})"
    - "useDecrypted exposes 4-state machine: idle | requesting | decrypted | error"
    - "EncryptedInput encrypts on blur via instance.createEncryptedInput; outputs handle + inputProof"
    - "ethers v6 mandatory; refuses if @typechain/ethers-v5 detected (FRONTEND-04)"
    - "Wagmi+viem opt-in via --with-wagmi flag; emits viem-compat shim"
    - "Skill REFUSES to import or reference fhevmjs anywhere"
  artifacts:
    - path: "plugins/zama-skills/skills/frontend/SKILL.md"
      provides: "Skill body with AskUserQuestion (with-wagmi?) + 3-file output workflow"
      contains: "AskUserQuestion"
    - path: "plugins/zama-skills/skills/frontend/scripts/generate.ts"
      provides: "Materialize 3 templates; preflight typechain v6 check"
      exports: ["generateFrontend"]
    - path: "plugins/zama-skills/skills/frontend/assets/templates/fhe.ts.tpl"
      provides: "relayer-sdk init template with getFhevmInstance singleton"
      contains: "createInstance"
    - path: "plugins/zama-skills/skills/frontend/assets/templates/useDecrypted.ts.tpl"
      provides: "React hook with explicit 4-state machine"
      contains: "requesting"
    - path: "plugins/zama-skills/skills/frontend/assets/templates/EncryptedInput.tsx.tpl"
      provides: "Controlled input encrypting on blur"
      contains: "createEncryptedInput"
  key_links:
    - from: "fhe.ts.tpl"
      to: "@zama-fhe/relayer-sdk"
      via: "import { initSDK, createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk/bundle'"
      pattern: "@zama-fhe/relayer-sdk"
    - from: "useDecrypted.ts.tpl"
      to: "fhe.ts (getFhevmInstance)"
      via: "import { getFhevmInstance } from '@/lib/fhe'"
      pattern: "getFhevmInstance"
---

<objective>
Author the `/zama-frontend` skill: write 3 React/TS files for fhEVM frontend integration. The hook surfaces a deliberate 4-state UX so users see "awaiting relayer", and the SDK init uses `@zama-fhe/relayer-sdk` (NOT deprecated fhevmjs).

Purpose: Implements all 4 FRONTEND-* requirements. The 4-state hook is the "good UX even when decrypts take 5-10s on Sepolia" feature.
Output: Working `/zama-frontend` skill that wires SDK + hook + input component into a /zama-init'd frontend package.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/phases/04-other-4-skills/04-CONTEXT.md
@CLAUDE.md
@plugins/zama-skills/skills/frontend/SKILL.md
@plugins/zama-skills/shared/prompts/decryption-paths.md
@plugins/zama-skills/shared/pinned-versions.json

<interfaces>
- Frontend dep version: `@zama-fhe/relayer-sdk@^0.4.2` (per CLAUDE.md alignment).
- Init pattern (fhe.ts):
  ```ts
  import { initSDK, createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/bundle";
  let _instance: Awaited<ReturnType<typeof createInstance>> | null = null;
  export async function getFhevmInstance() {
    if (_instance) return _instance;
    await initSDK();
    _instance = await createInstance({ ...SepoliaConfig, network: window.ethereum });
    return _instance;
  }
  ```
- Hook pattern (useDecrypted.ts):
  ```ts
  type Status = 'idle' | 'requesting' | 'decrypted' | 'error';
  function useDecrypted<T>(handle: string | null): { status: Status; value: T | undefined; error: Error | undefined; request: () => void };
  ```
  Implementation uses `getFhevmInstance()` + `instance.userDecrypt({ handles: [handle], ... })` and tracks status with useState.
- Component pattern (EncryptedInput.tsx):
  ```tsx
  <EncryptedInput contractAddress={addr} onEncrypted={({ handle, inputProof }) => ...} type="euint64" />
  ```
  Encrypts on blur via `instance.createEncryptedInput(addr, signerAddress).add64(value).encrypt()`.
- Wagmi opt-in: `--with-wagmi` flag → emits `fhe-wagmi.ts` shim that derives `network` from wagmi's `useWalletClient` instead of `window.ethereum`.
- typechain check: refuse if `@typechain/ethers-v5` present in `packages/frontend/package.json`. Suggest migration: `pnpm remove @typechain/ethers-v5 && pnpm add -D @typechain/ethers-v6 ethers@^6`.
- Output paths under `packages/frontend/src/{lib,hooks,components}/`.
- Refused imports: `fhevmjs` (any version) — post-grep guard.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author SKILL.md body</name>
  <files>plugins/zama-skills/skills/frontend/SKILL.md</files>
  <action>
1. Frontmatter: `allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit]`. No disable-model-invocation.

2. Workflow body:
   - Pre-flight: workspace detect (`packages/frontend/`), check ethers v6 + typechain v6, REFUSE on v5 with migration hint.
   - AskUserQuestion: Wagmi+viem? (yes/no). If yes, sets `--with-wagmi` flag for generate.ts.
   - AskUserQuestion: which contract to wire (auto-suggest from `packages/frontend/src/abis/*.json`).
   - Generate: Bash `${CLAUDE_SKILL_DIR}/scripts/generate.ts --contract <Name> [--with-wagmi]`.
   - Closing summary: 3 file paths printed, "awaiting relayer" UX state explained, sample usage snippet, "Next: ship via /zama-deploy or build for production."

3. Embed example usage block (markdown) showing `useDecrypted` and `EncryptedInput` together so users immediately see how to render the loading state.

4. Embed callout: "If your contract is fresh, run /zama-deploy first to populate `src/abis/<Name>.json` with deployed address."
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'); const s=fs.readFileSync('plugins/zama-skills/skills/frontend/SKILL.md','utf8'); for (const m of ['AskUserQuestion','useDecrypted','EncryptedInput','awaiting relayer','typechain']) if (!s.toLowerCase().includes(m.toLowerCase())) { console.error('missing:',m); process.exit(1); }"</automated>
  </verify>
  <done>SKILL.md has full workflow, example usage block, refusal callout for v5, "next" closing line.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement generate.ts + preflight + 4 templates</name>
  <files>plugins/zama-skills/skills/frontend/scripts/generate.ts, plugins/zama-skills/skills/frontend/scripts/lib/preflight.ts, plugins/zama-skills/skills/frontend/assets/templates/fhe.ts.tpl, plugins/zama-skills/skills/frontend/assets/templates/useDecrypted.ts.tpl, plugins/zama-skills/skills/frontend/assets/templates/EncryptedInput.tsx.tpl, plugins/zama-skills/skills/frontend/assets/templates/fhe-wagmi.ts.tpl, plugins/zama-skills/skills/frontend/scripts/generate.test.ts</files>
  <behavior>
    - generate({contract:"Counter"}) → writes src/lib/fhe.ts, src/hooks/useDecrypted.ts, src/components/EncryptedInput.tsx
    - generate({contract:"Counter", withWagmi:true}) → writes src/lib/fhe.ts USING the wagmi shim template
    - useDecrypted output literally contains the 4 status strings: 'idle', 'requesting', 'decrypted', 'error'
    - EncryptedInput output uses `instance.createEncryptedInput(...)` and emits `{ handle, inputProof }` to onEncrypted
    - preflight detects @typechain/ethers-v5 → returns error with migration command
    - preflight detects ethers ^5 → returns error
    - post-grep: 'fhevmjs' → 0 matches in any generated file
    - generate twice without --force → second aborts (file exists)
    - All emitted files pass `tsc --noEmit` against a /zama-init frontend's tsconfig
  </behavior>
  <action>
1. `fhe.ts.tpl`: per <interfaces>, with `getFhevmInstance` singleton + Sepolia chainId guard (refuse to init if `window.ethereum` chainId !== 11155111 — print to console.warn).

2. `useDecrypted.ts.tpl`:
   - Pure React hook (no third-party state lib).
   - Status state machine per <interfaces>.
   - `request()` is memoized; calls `getFhevmInstance().userDecrypt({...})`.
   - Comment block at top showing how to wrap with React Query / SWR for caching (per CONTEXT.md specifics).

3. `EncryptedInput.tsx.tpl`:
   - Controlled input.
   - Generic over euint type prop (`type: 'euint8'|'euint16'|'euint32'|'euint64'`).
   - On blur: encrypt → call `onEncrypted({ handle, inputProof })`.
   - Visible loading state during encrypt (buffer + spinner).

4. `fhe-wagmi.ts.tpl`: drop-in for `fhe.ts` when `--with-wagmi`; uses wagmi's `useWalletClient()` to derive a viem-compatible network reference.

5. `generate.ts`:
   - Parse `--contract <Name>`, `--with-wagmi`, `--force`.
   - preflight: typechain v6, no v5 typechain, no ethers v5.
   - Materialize templates (`@/abis/<Name>.json` import path is substituted in).
   - Post-grep `fhevmjs` against all 3 outputs; abort if found.
   - Refuse overwrite without --force.
   - Print written paths.

6. `preflight.ts`:
   - Workspace detect `packages/frontend/`.
   - Read `packages/frontend/package.json`; check `dependencies` + `devDependencies` for ethers/typechain versions.
   - Refuse v5; suggest exact migration cmd.

7. vitest cases for all behaviors above. Use temp fixture `packages/frontend/package.json` files.
  </action>
  <verify>
    <automated>pnpm vitest run plugins/zama-skills/skills/frontend/scripts/generate.test.ts</automated>
  </verify>
  <done>vitest green; generated files import only @zama-fhe/relayer-sdk (not fhevmjs); 4 status strings present in useDecrypted; wagmi shim emitted only with flag; v5 detection blocks generation.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User → Component (encrypted input) | Untrusted: numeric value bounds vs euint type |
| Frontend → Sepolia (window.ethereum) | Real wallet; chain mismatch → wrong-chain tx |
| Skill template → user repo | Template tampering could inject deprecated package |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-19 | Tampering | Skill emits fhevmjs import | mitigate | Post-grep in generate.ts; refused with abort (Task 2) |
| T-04-20 | Tampering | typechain v5 silently mixed in | mitigate | preflight refuses v5 with migration cmd (Task 2) |
| T-04-21 | Information Disclosure | useDecrypted logs decrypted value to console | accept | User-controlled; no PII in scope |
| T-04-22 | Spoofing | Wallet on wrong chain | mitigate | fhe.ts chainId guard logs warn; recommend MetaMask deep-link from /zama-init |
| T-04-23 | Denial of Service | Multiple parallel decrypt requests | accept | Hook uses request() user-triggered only |
| T-04-24 | Elevation of Privilege | EncryptedInput value > euint type bounds | mitigate | Component validates value < 2^N before encrypting; throws on overflow |
</threat_model>

<verification>
1. `pnpm vitest run plugins/zama-skills/skills/frontend/` green
2. Manual: in a /zama-init'd frontend, run skill → 3 files appear; `pnpm tsc --noEmit` exits 0; sample component renders 4 states.
3. Negative: add `@typechain/ethers-v5` to package.json → preflight refuses.
4. `--with-wagmi`: emits the wagmi shim instead of vanilla window.ethereum.
</verification>

<success_criteria>
- All 4 FRONTEND-* requirements satisfied
- 0 fhevmjs references in any output or template
- 4 explicit status states in useDecrypted
- Wagmi opt-in path works
- ethers v5 / typechain v5 refused
</success_criteria>

<output>
Create `.planning/phases/04-other-4-skills/04-04-SUMMARY.md` with: files generated, 4 states verified, wagmi flag tested, vitest summary, sample usage snippet path.
</output>
