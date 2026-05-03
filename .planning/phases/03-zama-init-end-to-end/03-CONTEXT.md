# Phase 3: /zama-init End-to-End - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning
**Mode:** Smart discuss (4 areas accepted)
**Critical path:** ⚡ Phase 3 cascades to Phase 4

<domain>
## Phase Boundary

Phase 3 delivers the headline `/zama-init` skill end-to-end. A user in an empty directory invokes `/zama-init` in Claude Code, picks one of 4 use-cases (token / voting / auction / custom), and ends with a working pnpm monorepo at `./<use-case>-dapp/` that:

- has all deps installed (`pnpm install` succeeded)
- compiles green (`pnpm hardhat compile` succeeded)
- contains zero deprecated imports (`fhevmjs`, root `fhevm`)
- pins versions from Phase 2's `shared/pinned-versions.json`
- includes `.env.example` + Sepolia onboarding docs (faucets, MetaMask deep-link)
- ends with a markdown closing summary listing what was created and the next 3 commands

Out of scope: contract authoring beyond seed (Phase 4 `/zama-contract`), test scaffolding beyond template (Phase 4 `/zama-test`), deploy/verify (Phase 4 `/zama-deploy`), frontend FHE encryption flows (Phase 4 `/zama-frontend`), the curated reference dApp (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Scaffold Strategy & Use-Case Branching
- Source: **`fhevm-react-template` git clone** (Zama's official template); post-process to remove deprecated bits, sync versions from `shared/pinned-versions.json`, and tailor the seed contract to the chosen use-case.
- 4 use-cases:
  1. `confidential-token` — `ERC7984ERC20Wrapper` minimal mint/transfer
  2. `voting` — `VotesConfidential` demo poll
  3. `auction` — custom `euint64` sealed-bid pattern (no OZ primitive)
  4. `custom` — empty-but-imported skeleton (comments + import scaffold for `FHE.sol`, `euint*`)
- Selection: `AskUserQuestion` single-select, each option ships a 1-line "what you'll get" description.
- Target location: **`./<use-case>-dapp/` subdirectory under CWD** (e.g. `./voting-dapp/`). Lets users iterate on multiple use-cases without colliding.

### Environment Setup & Secret Handling
- `.env.example` ships with: `INFURA_API_KEY`, `MNEMONIC` (12-word note), `ETHERSCAN_API_KEY`, `RELAYER_URL=https://relayer.testnet.zama.cloud`, `SEPOLIA_RPC_URL` (template). Each line gets a comment explaining where to obtain it.
- MetaMask Sepolia: README links to **chainlist.org Sepolia deep-link** (browser handles network add). No custom HTML page.
- Faucets: README ships **3 faucet links** (Alchemy Sepolia faucet, Chainlink faucet, sepoliafaucet.com) — user picks fastest.
- Secrets: `.env` in `.gitignore`, `.env.example` committed, mnemonic banner: "test mnemonic only — never use mainnet keys".

### Skill Execution Flow & Validation Gates
- Pre-flight: check Node `>=20`, `pnpm` available, internet (lightweight context7 ping). On failure, print actionable error.
- After scaffold write: skill **runs `pnpm install`** (with progress) and `pnpm hardhat compile` to prove compile-green. Does NOT run deploy or tests (user supplies `.env` first).
- On compile failure: skill summarizes the error, suggests `pnpm hardhat clean && pnpm hardhat compile`, then escalates with a context7 query for fhEVM-specific failure mode. No auto-iterate (deterministic for the bounty demo).
- Closing summary: markdown block with file inventory grouped by directory (`contracts/`, `test/`, `frontend/`, `scripts/`), a list of commands that already passed, and the **next 3 actions** (`/zama-contract`, `/zama-test`, `/zama-deploy --sepolia`) with one-liner explanations.

### Generated Project Structure & Deprecation-Free Guarantee
- Layout: **pnpm workspace monorepo**:
  - `packages/contracts/` — Hardhat config, contracts, tests, deploy scripts
  - `packages/frontend/` — Vite + React 18, ethers v6, `@zama-fhe/relayer-sdk@^0.4.2`
  - Root: `pnpm-workspace.yaml`, `package.json` (workspace scripts), `.env.example`, `README.md`, `.gitignore`
- Frontend stack pinned: Vite + React 18 + ethers v6 + relayer-sdk `^0.4.2`. Skill mentions viem as an alternative the user can swap in later but never emits viem-based scaffold by default.
- Deprecation-free guard: post-scaffold the skill **greps recursively** for `fhevmjs` and `"fhevm":` (root pkg). On any match: abort with explicit error (must not happen if our shared/ logic is right; this is a belt-and-suspenders check that fails loud).
- Seed contracts live under `packages/contracts/contracts/<UseCase>.sol` — minimum-viable, compile-clean, comments cite Zama doc URLs (not addresses). Each seed includes the right ACL pattern (`FHE.allowThis(handle)` after each state write).

</decisions>

<code_context>
## Existing Code Insights

Phase 1 + 2 deliver:
- `plugins/zama-skills/skills/init/SKILL.md` — Phase 1 skeleton with sync markers (Phase 2 materialized: context7-query, anti-deprecation, deprecation-guard, versions-table, sepolia-faucet, closing-summary)
- `plugins/zama-skills/shared/{pinned-versions.json, deprecated-imports.json, context7-query.md, snippets/*, prompts/*}` — Phase 2 outputs
- `scripts/build.ts`, `scripts/lib/{markers,generic,versions}.ts` — sync engine
- `scripts/validate.ts` extended with drift check

Reusable assets:
- `pnpm sync` already keeps SKILL.md content in lockstep with shared/
- `closing-summary.md` prompt already in shared/prompts/ — Phase 3 fills its `{{VERSIONS_TABLE}}` and `{{SEPOLIA_FAUCET}}` placeholders at runtime
- `getVersion(pkg)` and `isDeprecated(pkg)` helpers from `scripts/lib/versions.ts` are reused by skill templates
- `decryption-paths.md` and `acl-tip.md` snippets used by Phase 4 skills, NOT init

Established patterns:
- pnpm workspace + tsx for scripts, vitest for unit tests
- TypeScript strict + `noUncheckedIndexedAccess`
- Atomic commits with conventional prefixes per plan

Integration points:
- `plugins/zama-skills/skills/init/` — main skill body lives here; assets/templates also bundled here
- `plugins/zama-skills/skills/init/assets/` (new) — Hardhat config template, .env.example, README, seed contracts per use-case
- `plugins/zama-skills/skills/init/scripts/` (new) — runtime helper scripts (env injection, post-scaffold grep, install runner) referenced via `${CLAUDE_SKILL_DIR}`
- Hardhat config template uses `import "@fhevm/hardhat-plugin"` and pulls versions from `shared/pinned-versions.json` at sync time

</code_context>

<specifics>
## Specific Ideas

- README seed must contain **30-second value prop** at the top (matches PROJECT.md positioning) — judges may copy this to the bounty submission writeup
- The closing summary must explicitly say "context7 was queried at scaffold time — every dependency pin is verified live, no hallucinated APIs"
- `confidential-token` use-case must register with the Confidential Token Registry on Sepolia — but the registration **call** is deferred to `/zama-deploy` (Phase 4); init only ships the registration script as `scripts/register-token.ts`
- Seed contract for `auction` cites Zama's official auction example via context7 source `/zama-ai/fhevm` topic "auction"
- `custom` use-case must include the deprecation guard comment block at the top of the seed file (visible reminder for the developer)

</specifics>

<deferred>
## Deferred Ideas

- Mainnet deploy support — Phase 6 / v2 scope
- Auto-faucet integration (deferred — APIs are rate-limited and unreliable)
- Wallet generation flow (use a fresh wallet from MetaMask) — manual is fine for v1
- Turborepo / Nx orchestration (deferred — pnpm workspace is enough)
- Next.js variant (deferred — skill mentions but doesn't ship)
- viem-based scaffold variant (deferred — mention as alternative only)
- Cursor `.cursorrules` native format (deferred per PROJECT.md)
- `/zama-init --resume` to repair a half-scaffolded project (deferred — start fresh in v1)

</deferred>
