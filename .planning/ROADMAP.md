# Roadmap: zama-skills

**Created:** 2026-05-03
**Submission deadline:** 2026-05-10 23:59 AOE (target submit: 2026-05-09, ~6 working days)
**Granularity:** coarse (6 phases — research-driven; one phase per natural delivery boundary)
**Coverage:** 41/41 v1 requirements mapped
**Critical path:** Phase 3 (`/zama-init` end-to-end) — every other skill assumes its scaffold output

## Phases

- [x] **Phase 1: Plugin Foundation + CI** — installable skeleton, valid manifests, schema validation in CI ✅ COMPLETE (2026-05-03)
- [ ] **Phase 2: Shared Infrastructure** — pinned versions, context7 prompt, deprecation banlist, transclusion build (Day 1-2, ~0.5 day)
- [ ] **Phase 3: `/zama-init` End-to-End** [CRITICAL PATH] — load-bearing scaffolder; produces working confidential dApp skeleton (Day 2-4, ~2 days)
- [ ] **Phase 4: Other 4 Skills** — `/zama-contract`, `/zama-test`, `/zama-deploy`, `/zama-frontend` (Day 4-5, ~1.5 days; parallelization=true allows internal interleaving)
- [ ] **Phase 5: Reference Example dApp** — `examples/confidential-token/` deployed to Sepolia + Vercel (Day 5-6, ~1 day)
- [ ] **Phase 6: Distribution + Submission** — generic markdown, README, npm publish, clean-VM test, submit (Day 6-7, ~1 day)

## Phase Details

### Phase 1: Plugin Foundation + CI
**Goal**: A judge can run `/plugin marketplace add` + `/plugin install zama-skills@zama-skills` against the GitHub repo and the plugin loads cleanly with all 5 SKILL.md skeletons recognized.
**Depends on**: Nothing (first phase)
**Requirements**: PLUGIN-01, PLUGIN-02, PLUGIN-03, PLUGIN-04, PLUGIN-06
**Day budget**: ~1 day (Day 1)
**Success Criteria** (what must be TRUE):
  1. Running `/plugin marketplace add github.com/<owner>/zama-skills` followed by `/plugin install zama-skills@zama-skills` in Claude Code completes without error and lists all 5 skills.
  2. All 5 SKILL.md files have valid frontmatter (`name`, `description`, `when_to_use`, `allowed-tools`) and `description+when_to_use` combined ≤1536 chars — verified by `vitest run` (frontmatter + schema tests pass).
  3. `/zama-deploy` SKILL.md frontmatter contains `disable-model-invocation: true` — verified by automated test.
  4. CI (GitHub Actions) is green on `main` and shows green badge in README placeholder — `npm run validate` passes (zod manifest validation).
**Plans**: TBD

### Phase 2: Shared Infrastructure
**Goal**: A maintainer can bump `@fhevm/solidity` version in exactly one file and the change propagates to every skill's assets, examples, and generic docs deterministically; every SKILL.md transcludes the same context7-query block from one source.
**Depends on**: Phase 1
**Requirements**: SHARED-01, SHARED-02, SHARED-03, SHARED-04, SHARED-05
**Day budget**: ~0.5 day (Day 1-2)
**Success Criteria** (what must be TRUE):
  1. Editing `shared/pinned-versions.json` and running `node scripts/build.mjs` updates every `assets/**/package.json` template — verifiable by diff.
  2. A SKILL.md containing `<!-- include: ../../shared/context7-query.md -->` is expanded inline by `scripts/build.mjs` so the published artifact contains no transclusion markers.
  3. Adding a new entry to `shared/deprecated-imports.json` (e.g., `fhevmjs`) is the only file change needed for the future D3 hook to enforce it.
  4. `shared/prompts/{anti-deprecation,closing-summary,decryption-paths}.md` exist and are referenced by at least one skill via transclusion marker.
**Plans**: TBD

### Phase 3: `/zama-init` End-to-End [CRITICAL PATH]
**Goal**: A user in an empty directory runs `/zama-init` in Claude Code, picks a use-case, and ends with a working `pnpm install` + `pnpm hardhat compile` green project pinned to non-deprecated fhEVM versions.
**Depends on**: Phase 1, Phase 2
**Requirements**: INIT-01, INIT-02, INIT-03, INIT-04, INIT-05, INIT-06
**Day budget**: ~2 days (Day 2-4) — LARGEST single-skill investment; failure here invalidates everything else
**Success Criteria** (what must be TRUE):
  1. Running `/zama-init` interactively prompts for use-case (token / voting / auction / custom) and proceeds with the chosen branch — verifiable by manual smoke test.
  2. After `/zama-init` completes in a fresh empty directory, `pnpm install` succeeds and `pnpm hardhat compile` exits green — no compile errors, no deprecation warnings for `fhevmjs` or `fhevm` (root).
  3. Generated `.env.example` contains all required keys (Sepolia RPC URL, mnemonic, Etherscan API key, relayer URL, registry address) with comments explaining each.
  4. Closing summary message lists exactly what was installed, the next 4 skills to run (compile/test/deploy/frontend) with what each does, and a clickable MetaMask Sepolia network-add deep link (`https://chainid.network/?...`).
  5. Generated `package.json` contains zero deprecated packages (grepped post-scaffold) — versions match `shared/pinned-versions.json` exactly.
**Plans**: TBD

### Phase 4: Other 4 Skills (`/zama-contract`, `/zama-test`, `/zama-deploy`, `/zama-frontend`)
**Goal**: A user with a `/zama-init`'d project can invoke each of the remaining 4 skills and get correct, ACL-safe, deprecation-free, deploy-ready output that handles the 3 decryption paths and HCU constraints correctly.
**Depends on**: Phase 3
**Requirements**: CONTRACT-01, CONTRACT-02, CONTRACT-03, CONTRACT-04, CONTRACT-05, TEST-01, TEST-02, TEST-03, TEST-04, DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, FRONTEND-01, FRONTEND-02, FRONTEND-03, FRONTEND-04
**Day budget**: ~1.5 days (Day 4-5) — internal build order: `/zama-contract` → `/zama-test` → `/zama-deploy` → `/zama-frontend`; parallelization=true allows interleaving research/asset work
**Success Criteria** (what must be TRUE):
  1. Running `/zama-contract` to add a state-write function emits Solidity that includes `FHE.allowThis(handle)` and `FHE.allow(handle, msg.sender)` after the assignment — visible in generated source; rejects any `require(decrypt(...))` plaintext leak pattern.
  2. Running `/zama-test` produces both a mock test file (using `@fhevm/hardhat-plugin` encrypted-input mock) AND a Sepolia integration scaffold gated by `network.name === "sepolia"`.
  3. Running `/zama-deploy` against a Sepolia env (a) requires user confirmation (model-invocation disabled), (b) fetches the live Sepolia ACL/KMS/Registry addresses via `WebFetch` (not pinned), (c) deploys + Etherscan verifies + auto-registers a token contract with the Confidential Token Registry — verifiable by tx hash on Sepolia Etherscan.
  4. Running `/zama-frontend` produces React code that imports `SepoliaConfig` from `@zama-fhe/relayer-sdk`, includes a `useDecrypted(handle)` hook with explicit "awaiting relayer" UX state, and uses `ethers@^6` (not v5) + typechain.
  5. Manually invoking all 4 skills in sequence on a single project does not clobber prior skills' output (boundary contract enforced).
**Plans**: TBD
**UI hint**: yes

### Phase 5: Reference Example dApp
**Goal**: A judge clicks the README link and within 30 seconds sees a working confidential-token dApp at a live Vercel URL with a verified Sepolia contract — proves the skills produce real production-grade output.
**Depends on**: Phase 4
**Requirements**: EXAMPLE-01, EXAMPLE-02, EXAMPLE-03, EXAMPLE-04, EXAMPLE-05
**Day budget**: ~1 day (Day 5-6)
**Success Criteria** (what must be TRUE):
  1. `examples/confidential-token/` exists in the repo, was hand-curated from `/zama-init` + `/zama-contract` + others, and contains a `.gsd-snapshot.json` recording the skill versions and use-case used to seed it.
  2. The contract address printed in `examples/confidential-token/README.md` opens on Sepolia Etherscan with verified source code AND appears in the Confidential Token Registry.
  3. The Vercel URL printed in `examples/confidential-token/README.md` loads, allows MetaMask connection on Sepolia, accepts an encrypted input, submits a tx, and displays the user-decrypted result via the `useDecrypted` hook.
  4. CI smoke-diff job compares fresh `/zama-init token` output against `examples/confidential-token/` key files (`package.json` deps, `hardhat.config.ts`) and passes — confirming the example didn't drift from skill output.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Distribution + Submission
**Goal**: Submission is live on npm + GitHub marketplace ≥24h before the 2026-05-10 deadline, the README sells the differentiator in 30 seconds, and a fresh-VM install end-to-end has been verified by the author.
**Depends on**: Phase 5
**Requirements**: PLUGIN-05, DIST-01, DIST-02, DIST-03, DIST-04, DIST-05, DIST-06, DIST-07
**Day budget**: ~1 day (Day 6-7) — submission target 2026-05-09
**Success Criteria** (what must be TRUE):
  1. README first viewport contains: hero one-liner, single-line install snippet, 90-second demo video (embedded `.mp4` or GIF), 5-row skills table, live Sepolia contract URL, live Vercel frontend URL — verified by visual inspection on github.com.
  2. `npm view zama-skills version` returns the published version; running `npx zama-skills install` in a fresh directory copies skills to `~/.claude/skills/` (or project scope) and prints next steps.
  3. `generic/{zama-init,zama-contract,zama-test,zama-deploy,zama-frontend}.md` exist and are bit-identical to fresh output of `node scripts/generate-generic.mjs` (CI drift check green); `THIRD_PARTY_LICENSES.md` lists fhEVM (BSD-3-Clause-Clear), OZ Confidential Contracts, and FHE.js with correct attributions.
  4. Clean-VM end-to-end test (documented in `docs/release-checklist.md`) was completed ≥24h before deadline: fresh OS → install Claude Code → `/plugin marketplace add` → `/plugin install` → `/zama-init token` → deploy to Sepolia → frontend live — all working.
  5. Submission form filled and submitted by 2026-05-09 (≥24h before 2026-05-10 23:59 AOE deadline) with GitHub repo URL + npm package URL.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Plugin Foundation + CI | 4/5 | In progress | 01-04 done 2026-05-03 |
| 2. Shared Infrastructure | 0/0 | Not started | - |
| 3. /zama-init End-to-End [CRITICAL PATH] | 0/0 | Not started | - |
| 4. Other 4 Skills | 0/0 | Not started | - |
| 5. Reference Example dApp | 0/0 | Not started | - |
| 6. Distribution + Submission | 0/0 | Not started | - |

## Coverage Summary

- **Total v1 requirements:** 41
- **Mapped:** 41 (100%)
- **Unmapped:** 0
- **Categories covered:** PLUGIN (6), SHARED (5), INIT (6), CONTRACT (5), TEST (4), DEPLOY (5), FRONTEND (4), EXAMPLE (5), DIST (7) — sum = 41 ✓

## Critical Path Note

**Phase 3 (`/zama-init`) is the load-bearing skill.** Per research: every other skill (Phase 4) assumes the directory layout, `hardhat.config.ts` shape, and `.env` keys produced by `/zama-init`. If Phase 3 slips past Day 4, Phase 4 must compress or scope down. Mitigation: ship token + custom variants only for v1 minimum (voting/auction stretch).

## Risk Notes

- **Phase 4 size**: 18 requirements across 4 skills is the largest phase. Coarse granularity + research-driven phasing argue against splitting. If Day 4 ends without `/zama-init` complete, consider deferring `/zama-frontend` polish (FRONTEND-04 ethers v6 typechain) to Phase 6.
- **Phase 5 dependencies**: requires real Sepolia faucet, Alchemy/Infura key, Vercel account. Pre-acquire on Day 1 to avoid Day 5 blocker.
- **Phase 6 buffer**: Submission target = Day 7 of 7-day window. ≥24h buffer means hard-stop coding by end of Day 6.

---
*Roadmap created: 2026-05-03*
