# Phase 4: Other 4 Skills (`/zama-contract`, `/zama-test`, `/zama-deploy`, `/zama-frontend`) - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning
**Mode:** Smart discuss (4 areas accepted)
**Largest phase by surface area** — 4 skills × 17 requirements (CONTRACT-01..05, TEST-01..04, DEPLOY-01..04, FRONTEND-01..04)

<domain>
## Phase Boundary

A user with a `/zama-init`'d project can invoke each of the remaining 4 skills and get correct, ACL-safe, deprecation-free, deploy-ready output that handles the 3 decryption paths and HCU constraints correctly:

- **/zama-contract** — generate a new fhEVM contract (file written to `packages/contracts/contracts/<Name>.sol`) with auto-injected ACL grants, decryption-path discrimination, cleartext-leak refusal, and HCU budget reminder
- **/zama-test** — generate a mock test (`<Name>.test.ts`) and a Sepolia integration test (`<Name>.sepolia.test.ts`), both with ACL verification and the decrypt-after-call pattern
- **/zama-deploy** — 7-step Sepolia deploy: `.env` validation → compile → deploy → Etherscan verify → optional Confidential Token Registry registration → ABI export to frontend → closing summary with addresses + Etherscan link
- **/zama-frontend** — generate `src/lib/fhe.ts` (relayer-sdk init + SepoliaConfig), `src/hooks/useDecrypted.ts` (4-state hook), `src/components/EncryptedInput.tsx`; ethers v6 + typechain v6 mandatory (refuses v5)

Out of scope: the curated reference example dApp (Phase 5), submission/distribution (Phase 6), audit/debug skills (deferred to v2 per PROJECT.md).

</domain>

<decisions>
## Implementation Decisions

### Skill Architecture & Shared Logic
- 4 skills are **standalone** — each can run without `/zama-init` having been invoked first; each pre-flights for required deps and prints `Run /zama-init first to scaffold the project.` if it can't find a workspace
- Shared helpers live at `plugins/zama-skills/skills/_lib/` (or each skill's `scripts/lib/`) — at minimum: a tiny preflight (workspace detect, pnpm available, env file presence per skill needs), and per-skill closing-summary templates
- `pin-resolver.ts` from Phase 3 is NOT reused (Phase 4 skills don't materialize templates from `<!-- @pin: -->` blocks; they generate code based on user inputs)
- Output: each skill **writes files into the existing project** (e.g., `packages/contracts/contracts/<Name>.sol`, `packages/frontend/src/hooks/<name>.ts`). User reviews via `git status` then commits. Never stdout, never clipboard.
- `disable-model-invocation: true` ONLY on `/zama-deploy` (no auto-deploy). Other 3 skills auto-invoke OK.

### `/zama-contract` — ACL & Decryption Decisions
- Sequential `AskUserQuestion` flow: (1) contract name, (2) base contract — `ERC7984` / `VotesConfidential` / `standalone` / `Ownable` extension, (3) state schema (encrypted mapping or value type — `euint8/16/32/64`, `ebool`, `eaddress`), (4) decryption path — `public` / `user` / `oracle` (each option's description names a representative function pattern)
- **Auto-injected ACL grants**: every state-write that produces a handle gets `FHE.allowThis(handle)` immediately after; if the handle is exposed to a user (return value, getter), `FHE.allow(handle, msg.sender)` is added; ACL invariant block in skill body reminds user not to remove these
- **Cleartext-leak hard refusal**: skill body explicitly REFUSES to emit `require(decrypt(...))`, `require(FHE.decrypt(...))`, `if (decrypt(x))`, or any `==`/`!=`/`>`/`<` against a decrypted value. Suggests the canonical replacement: `ebool result = FHE.lt(a, b); FHE.allow(result, recipient);`
- **HCU reminder block** at top of every emitted contract: `// HCU budget: 20M/tx, 5M depth — heavy loops + nested FHE.select can exceed; use pnpm gas-report to profile`. Inline reminders inserted around any loop body or nested `FHE.select`.

### `/zama-test` & `/zama-deploy` Flows
- `/zama-test` produces TWO files per contract:
  1. `<Name>.test.ts` — mock/unit using `@fhevm/hardhat-plugin` mock-utils. Encrypted input mock → call → decrypt assertion. ACL verification (TEST-03): asserts that `FHE.allowThis` ran by re-decrypting from the same context.
  2. `<Name>.sepolia.test.ts` — integration. Spins up Sepolia signer, deploys, encrypts inputs, calls, awaits relayer decrypt, asserts. HCU revert risk noted in test header (TEST-04).
- `/zama-deploy` 7-step flow:
  1. Validate `.env` (DEPLOY-04) — abort with named-missing-vars list if any required var is missing
  2. `pnpm hardhat compile`
  3. Sepolia deploy (capture deployed address)
  4. `hardhat verify --network sepolia <address> <constructor-args>` (DEPLOY-01)
  5. If `confidential-token` use-case detected: invoke `scripts/register-token.ts` for Confidential Token Registry (DEPLOY-02)
  6. ABI export to `packages/frontend/src/abis/<Name>.json`
  7. Closing summary: deployed address, Etherscan URL, frontend env update reminder
- Sepolia contract addresses: **live WebFetch** (DEPLOY-03) `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` per deploy. Cached to `.cache/zama-addresses.json` with 24h TTL; refetched on stale.

### `/zama-frontend` — SDK Integration & Hooks
- 3-file output set:
  1. `src/lib/fhe.ts` — relayer-sdk init: `await initSDK()` + `createInstance({...SepoliaConfig, network: window.ethereum})`. Exposes singleton `getFhevmInstance()`
  2. `src/hooks/useDecrypted.ts` — React hook returning `{ status: 'idle' | 'requesting' | 'decrypted' | 'error', value: T | undefined, error: Error | undefined, request: () => void }`
  3. `src/components/EncryptedInput.tsx` — controlled input that encrypts on blur via `instance.createEncryptedInput(...)` and exposes the result for contract calls
- Library: **ethers v6 primary** (CLAUDE.md alignment). Wagmi + viem opt-in via `--with-wagmi` flag (skill detects via AskUserQuestion); when enabled, `lib/fhe.ts` exports a viem-compat shim
- typechain v6 mandatory: skill detects `@typechain/ethers-v5` in `package.json` → aborts with migration suggestion (FRONTEND-04)
- Hook UX: explicit 4-state machine; loading spinner pattern shown in component sample so users know how to render "awaiting relayer"

</decisions>

<code_context>
## Existing Code Insights

Phase 3 outputs reused or referenced:
- 5 SKILL.md skeletons (init, contract, test, deploy, frontend) — Phase 1 frontmatters + Phase 2 sync markers exist; Phase 3 fully wrote `init/`. Phase 4 fills `contract/`, `test/`, `deploy/`, `frontend/` skill bodies
- `plugins/zama-skills/shared/{snippets,prompts}/` — Phase 4 skills transclude: `decryption-paths.md` (CONTRACT, FRONTEND), `acl-tip.md` (CONTRACT, TEST), `anti-deprecation.md` (all 4), `closing-summary.md` (all 4 — placeholders vary per skill)
- `scripts/lib/versions.ts` (`getVersion`, `isDeprecated`) — used by deploy skill (`hardhat verify` step) to confirm `@nomicfoundation/hardhat-verify` pin
- `scripts/validate.ts` — extend to audit Phase 4 SKILL.md frontmatters and per-skill asset bundles
- `plugins/zama-skills/skills/init/scripts/scaffold.ts` post-grep — pattern reused for `/zama-deploy`'s deprecation re-check before deploy

Established patterns:
- pnpm workspace (root `pnpm-workspace.yaml` shipped via `/zama-init`)
- TypeScript strict + `noUncheckedIndexedAccess`
- Atomic commits with conventional prefix per plan
- vitest for unit tests; smoke harnesses gated by env var (`ZAMA_*_SMOKE=1`)

Integration points:
- `plugins/zama-skills/skills/contract/`, `test/`, `deploy/`, `frontend/` — each gets `SKILL.md` body + `scripts/` + optionally `assets/templates/` for the frontend lib/hook/component templates
- `packages/contracts/contracts/<Name>.sol` (target — written by /zama-contract)
- `packages/contracts/test/<Name>.test.ts` + `<Name>.sepolia.test.ts` (target — written by /zama-test)
- `scripts/deploy/<Name>.ts` + `scripts/register-token.ts` (target — written by /zama-deploy)
- `packages/frontend/src/{lib,hooks,components}` (target — written by /zama-frontend)

</code_context>

<specifics>
## Specific Ideas

- The `cleartext-leak hard refusal` is the project's biggest defensible differentiator vs vanilla LLM codegen — emphasize in skill body and in the closing summary message ("This contract refuses 12 known cleartext-leak patterns")
- `/zama-deploy` MUST query `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` LIVE — never pin Sepolia addresses; Phase 4 must NOT add a copy of these addresses to repo source
- `/zama-frontend` should show how to wrap `useDecrypted` in a React Query / SWR-friendly cache layer in a comment block (not a hard dep, but the pattern is well-known)
- The 4 skills should each end with a "next skill" suggestion in the closing summary: contract → test, test → deploy, deploy → frontend, frontend → ship

</specifics>

<deferred>
## Deferred Ideas

- `/zama-audit` (security review of generated contracts) — v2
- `/zama-debug` (interactive debugger for failed decryption) — v2
- Mainnet deploy support — out of scope (Sepolia only per PROJECT.md)
- Wallet connect / RainbowKit prebuilt component — not needed for the bounty demo; mention as upgrade path only
- Subgraph integration — v2
- Cross-chain encrypted bridges — far future

</deferred>
