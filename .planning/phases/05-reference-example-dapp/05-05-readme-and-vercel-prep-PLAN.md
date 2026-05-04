---
phase: 05-reference-example-dapp
plan: 05
type: execute
wave: 4
depends_on: [03, 04]
files_modified:
  - examples/confidential-token/README.md
  - examples/confidential-token/docs/vercel-setup.md
  - examples/confidential-token/docs/demo.gif
  - README.md
autonomous: false
requirements: [EXAMPLE-03, DIST-01]
must_haves:
  truths:
    - "examples/confidential-token/README.md is a hero document — first viewport: title, live Vercel URL, verified Sepolia contract badge, 90s GIF placeholder"
    - "Vercel setup steps for the user are documented — they do GitHub-bind themselves; we don't run Vercel CLI per CONTEXT.md"
    - "README links Etherscan verified contract + Registry entry + Vercel URL placeholder"
    - "Root project README has a 'Try it live' section pointing to the example with Vercel URL placeholder + GIF"
    - "All three required NEXT_PUBLIC_* env vars are documented in Vercel setup steps"
    - "Vercel URL placeholder is a clearly marked TODO so user can fill after binding repo"
  artifacts:
    - path: "examples/confidential-token/README.md"
      provides: "Hero README — judge entry point"
      contains: "Try it live"
    - path: "examples/confidential-token/docs/vercel-setup.md"
      provides: "Step-by-step Vercel binding instructions for the user"
      contains: "vercel.com/new"
    - path: "README.md"
      provides: "Root README updated with example link"
      contains: "examples/confidential-token"
  key_links:
    - from: "examples/confidential-token/README.md"
      to: "examples/confidential-token/DEPLOYED.md"
      via: "links to Etherscan + Registry from the deploy artifact"
      pattern: "DEPLOYED.md"
    - from: "examples/confidential-token/README.md"
      to: "examples/confidential-token/.gsd-snapshot.json"
      via: "'How this was built' section references snapshot"
      pattern: ".gsd-snapshot.json"
---

<objective>
Author the example's hero README so a judge clicking the link in the root README sees, in the first viewport: the live Vercel URL, the verified Sepolia contract address with badge, a 90-second GIF demo, and one-line install/try-it instructions. Document the Vercel-binding steps for the user (we don't run Vercel CLI). Update the root project README to link the example.

Purpose: This is what the bounty submission landing experience looks like. DIST-01 (root README hero) gets a partial assist here — the example README provides content the root README quotes.
Output: Two READMEs + a Vercel setup doc. After this plan + the user binding Vercel to the repo, EXAMPLE-03 is met (live Vercel URL accessible).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/phases/05-reference-example-dapp/05-CONTEXT.md
@CLAUDE.md
@plugins/zama-skills/skills/_lib/closing-summary.ts
@README.md

<interfaces>
README structure (`examples/confidential-token/README.md`):
```
# Confidential Demo Token (cDEMO) — Live on Sepolia

> A confidential ERC-7984 token built end-to-end with the **zama-skills** Claude Code plugin.
> Encrypted balances. Public transfers. Powered by fhEVM.

[![Verified](badge: green check)](etherscan link) [![Registry](badge)](registry link) [![Vercel](badge)](vercel url)

## Try it live
- Frontend: https://zama-skills.vercel.app  (← TODO: fill after Vercel binds repo)
- Contract: <SEPOLIA_ADDRESS> on Etherscan
- Registry: cDEMO entry

## 90-second demo
![demo](docs/demo.gif)  ← placeholder; replace with real GIF

## What this proves
- The skills produce real, deployable, production-grade output (EXAMPLE-01)
- The fhEVM relayer + ACL flow round-trips through a real wallet (EXAMPLE-03)

## How this was built
1. /zama-init confidential-token (monorepo)
2. /zama-contract → ERC7984 base + user decryption path
3. /zama-test → mock + sepolia tests
4. /zama-deploy → Sepolia + verify + Registry register
5. /zama-frontend → relayer-sdk + useDecrypted + EncryptedInput
6. Hand-curated: Next.js 15 + shadcn/ui + Magic MCP polish

See `.gsd-snapshot.json` for the exact skill commit SHAs used.

## Local dev
1. `pnpm install`
2. `pnpm --filter contracts hardhat compile`
3. `cp packages/frontend/.env.local.example packages/frontend/.env.local` and fill keys
4. `pnpm --filter frontend dev`

## Deploy your own
See `docs/vercel-setup.md`.
```

`docs/vercel-setup.md`:
```
# Deploying this example to Vercel

You bind Vercel to the GitHub repo (we don't run Vercel CLI in this project).

1. Push the repo to GitHub
2. Visit https://vercel.com/new and import the repo
3. Set Root Directory: examples/confidential-token/packages/frontend
4. Framework preset: Next.js (auto-detected)
5. Add environment variables (from packages/frontend/.env.local.example):
   - NEXT_PUBLIC_CONTRACT_ADDRESS = <from DEPLOYED.md>
   - NEXT_PUBLIC_SEPOLIA_RPC      = <your Alchemy/Infura URL>
   - NEXT_PUBLIC_RELAYER_URL      = https://relayer.testnet.zama.cloud
   - NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID = <from cloud.walletconnect.com>
6. Deploy
7. Copy the production URL into examples/confidential-token/README.md "Try it live" line + the root README "Live demo" line
```

Root README addition (DIST-01 partial):
- Add "## Try it live" section with one-line pitch + link to `examples/confidential-token/`
- Show the cDEMO Etherscan badge + Vercel URL placeholder
- Include a single 90s GIF reference (same `docs/demo.gif` placeholder for now)

`docs/demo.gif`: commit a placeholder text file `docs/demo.gif.TODO` explaining how to record the GIF (90 seconds, MetaMask Sepolia, mint → balance decrypt → transfer). Real GIF lands in Phase 6 polish.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author examples/confidential-token/README.md + docs/vercel-setup.md + GIF placeholder</name>
  <files>examples/confidential-token/README.md, examples/confidential-token/docs/vercel-setup.md, examples/confidential-token/docs/demo.gif.TODO</files>
  <action>
1. Generate `examples/confidential-token/README.md` per the structure in `<interfaces>`. Pull live values from `examples/confidential-token/DEPLOYED.md` (Etherscan link, Registry link, address). Put `https://zama-skills.vercel.app` as a literal placeholder string with HTML comment `<!-- @sync:vercel-url -->` so a future build hook can patch it post-bind.
2. Use shields.io badges:
   - `https://img.shields.io/badge/Sepolia-Verified-brightgreen?logo=ethereum`
   - `https://img.shields.io/badge/Registry-Listed-yellow`
   - `https://img.shields.io/badge/Vercel-Live-black?logo=vercel` (link to placeholder URL)
3. Generate `docs/vercel-setup.md` per `<interfaces>` — exact verbatim text so a user copy-pastes their way through.
4. Create `docs/demo.gif.TODO` with recording instructions (90s, MetaMask Sepolia, sequence: connect → mint → balance decrypt 4-state → transfer → balance refresh). State which screen-recorder + GIF tool to use.
5. Commit: `docs(05): hero README + vercel setup for confidential-token example`.
  </action>
  <verify>
    <automated>cd examples/confidential-token && grep -q "Try it live" README.md && grep -q "Sepolia" README.md && grep -q "@sync:vercel-url" README.md && grep -q "vercel.com/new" docs/vercel-setup.md && grep -q "NEXT_PUBLIC_CONTRACT_ADDRESS" docs/vercel-setup.md && test -f docs/demo.gif.TODO</automated>
  </verify>
  <done>Hero README renders correctly on github.com (manual check); all four NEXT_PUBLIC_* vars in vercel-setup; GIF TODO placeholder explains capture flow.</done>
</task>

<task type="auto">
  <name>Task 2: Update root README with "Try it live" section linking the example</name>
  <files>README.md</files>
  <action>
1. Read existing root `README.md`. Identify the "Try it live" / "Live demo" / "Examples" section (or a sensible location near the top).
2. Insert a new section (after the headline + install snippet, before the skills table):
   ```
   ## Try it live

   [![Vercel](https://img.shields.io/badge/Vercel-Live-black?logo=vercel)](https://zama-skills.vercel.app) [![Sepolia](https://img.shields.io/badge/Sepolia-Verified-brightgreen?logo=ethereum)](<ETHERSCAN_URL>)

   See [`examples/confidential-token/`](examples/confidential-token/) — a confidential ERC-7984 token deployed to Sepolia and live on Vercel. Built by running this plugin's skills against an empty directory.

   ![demo](examples/confidential-token/docs/demo.gif)  <!-- placeholder until Phase 6 records the real GIF -->
   ```
3. Substitute `https://zama-skills.vercel.app` with the same `<!-- @sync:vercel-url -->` marker; substitute `<ETHERSCAN_URL>` with the actual address from `DEPLOYED.md`.
4. Do NOT touch other sections of the root README — DIST-01's full hero is Phase 6's job. This is the partial assist (link + badges).
5. Commit: `docs(05): root README links to confidential-token live demo`.
  </action>
  <verify>
    <automated>grep -q "examples/confidential-token" README.md && grep -q "Try it live" README.md && grep -q "@sync:vercel-url" README.md</automated>
  </verify>
  <done>Root README has the "Try it live" section with badges + link + GIF reference; existing root content unchanged.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: User binds Vercel to the GitHub repo and fills VERCEL_URL</name>
  <what-built>Hero README + Vercel setup doc. Vercel cannot be bound to a repo via CLI in this project (per CONTEXT.md decision); the user must do this step themselves.</what-built>
  <how-to-verify>
1. Push the current branch to GitHub (you already do this normally).
2. Open https://vercel.com/new, import the repo.
3. Root Directory: `examples/confidential-token/packages/frontend`. Framework: Next.js (auto).
4. Add the four environment variables from `examples/confidential-token/docs/vercel-setup.md`.
5. Deploy.
6. Copy the production URL.
7. Replace BOTH `https://zama-skills.vercel.app` placeholders (in `examples/confidential-token/README.md` and root `README.md`) with the production URL.
8. Open the URL, connect MetaMask on Sepolia, click Mint — confirm BalanceCard 4-state UX runs end-to-end.
  </how-to-verify>
  <resume-signal>Reply with the Vercel production URL (or "deferred" if you want to defer Vercel binding to Phase 6 polish — EXAMPLE-03 stays Pending in that case).</resume-signal>
</task>

</tasks>

<verification>
1. `examples/confidential-token/README.md` first viewport: title, badges, Try it live, 90s GIF reference.
2. `docs/vercel-setup.md` documents all four env vars.
3. Root README has a "Try it live" entry linking the example.
4. After user binds Vercel + fills VERCEL_URL, EXAMPLE-03 fully met.
</verification>

<success_criteria>
- Hero README ready for judges
- Vercel binding instructions are unambiguous and copy-paste-able
- Root README links the live demo (DIST-01 partial)
- A clear single source of truth for the Vercel URL (`@sync:vercel-url` marker) so Phase 6 can automate the fill
</success_criteria>

<output>
Create `.planning/phases/05-reference-example-dapp/05-05-SUMMARY.md` with: README structure decisions, Vercel URL fill status (URL or "deferred"), GIF capture status, root README diff size.
</output>
