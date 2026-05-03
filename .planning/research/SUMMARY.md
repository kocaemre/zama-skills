# Project Research Summary

**Project:** zama-skills
**Domain:** Claude Code plugin (skill package) + Zama fhEVM zero-to-deploy scaffolder + Bounty submission
**Researched:** 2026-05-03
**Confidence:** HIGH

## Executive Summary

`zama-skills` is a two-layer product: (A) a Claude Code plugin shipping 5 slash-command skills for building on Zama's fhEVM protocol, and (B) a reference example dApp the skills produce. The defining architectural decision confirmed across all four research files is that every skill must query context7's `/zama-ai/fhevm` (1772 snippets), `/zama-ai/fhevm-hardhat-template`, and `/websites/openzeppelin_confidential-contracts` before emitting any code. This "live-doc orchestration" is the single defensible differentiator against any other bounty submission — it prevents the stale-training-data hallucination problem that will afflict non-context7 approaches. No other published Claude Code skill does this for fhEVM.

The fhEVM stack has two critical deprecation landmines: `fhevmjs` and `fhevm` (root package), both officially deprecated 2025-07-10. Every tutorial from 2024–early 2025 references these dead packages. The correct packages are `@fhevm/solidity@^0.11.1`, `@zama-fhe/relayer-sdk@^0.4.2`, `@fhevm/hardhat-plugin@^0.4.2`, and `@openzeppelin/confidential-contracts@^0.4.0` — all version-verified against the live npm registry on 2026-05-03. Two hard constraints not covered by tutorials: Hardhat 3.x is incompatible with the fhevm plugin (peer-dep requires `^2.0.0`), and ethers v5 mismatches typechain output (v6 required).

The key risk is timeline. The critical path runs through `/zama-init` working end-to-end (T6). Everything else is window dressing if that skill fails. The second major risk is submitting code that only works against `@fhevm/mock-utils` — mocks do NOT enforce HCU limits (20M per tx) or async decrypt semantics, so real-Sepolia failures are common. The third risk is a bad README: judges scan the top-of-page in 30 seconds; most fhEVM repos fail this test.

## Key Findings

### Recommended Stack

**Layer A (skill package itself):**
- `SKILL.md` + `plugin.json` + `marketplace.json` — Claude Code plugin format (custom commands are now a strict subset of skills; use skills)
- Node.js `>=20` / TypeScript `^5.9.3` — CLI runtime for `npx zama-skills install`
- `commander ^12`, `fs-extra ^11`, `zod ^3` — install CLI + manifest validation
- `vitest ^2` — unit tests for install CLI and schema validation

**Layer B (fhEVM code the skills generate):**
- `@fhevm/solidity@^0.11.1` — Solidity FHE library; replaces deprecated `fhevm`
- `@openzeppelin/confidential-contracts@^0.4.0` — ERC-7984 token + governance; peer-deps `@fhevm/solidity` exactly at `0.11.1`
- `@fhevm/hardhat-plugin@^0.4.2` — mock testing; peer-deps tight (bumping any of `mock-utils`, `relayer-sdk`, `ethers` without matching plugin = broken install)
- `@zama-fhe/relayer-sdk@^0.4.2` — frontend encrypted inputs + user decryption; replaces deprecated `fhevmjs`
- `hardhat@^2.28.4` only — fhevm plugin does NOT support Hardhat 3.x
- `ethers@^6.16.0` — fhevm plugin and typechain both require v6
- Sepolia testnet only — Zama's ACL/KMS/Coprocessor live there; mainnet is v2

### Expected Features

**Must-have (table stakes — missing = half-baked):**
- T1/T2/T3 — One-line plugin install + valid schemas + complete SKILL.md frontmatter
- T4/T5 — `disable-model-invocation: true` on `/zama-deploy` + `allowed-tools` whitelist
- T6 — `/zama-init` works end-to-end: scaffold → compile → test → Sepolia deploy → frontend with working decryption
- T7/T8 — No deprecated packages emitted + context7 live-query in every skill
- T9/T10 — Polished README with demo video + live example dApp on Sepolia + Vercel
- T11/T13 — `.env.example` scaffolding + auto-generated generic markdown rehbers

**Should-have (differentiators that win):**
- D1 — Context7 architecture made explicit and sold in README
- D2 — Use-case picker (token / voting / auction / custom) branching to correct OZ primitive
- D3 — Anti-deprecated-import PostToolUse hook
- D4 — `useDecrypted(handle)` React hook with "awaiting relayer" UX
- D5 — Confidential Token Registry auto-registration in `/zama-deploy`
- D8 — MetaMask network-add deep-link (eliminates #2 pain point)
- D11 — README demo video ≤90s

**Defer to v2:** `/zama-audit`, `/zama-debug`, mainnet support, native Cursor `.cursorrules`

### Architecture Approach

One plugin (`zama-skills`) bundles all 5 skills — never 5 separate plugins. `shared/` lives inside the plugin dir (relative paths outside it break post-install). `generic/*.md` is auto-generated from SKILL.md and drift-checked by CI. `shared/pinned-versions.json` is the single source of truth for all `@fhevm/*` versions. Examples are hand-curated gold standards, not raw skill output.

**Major components:**
1. `marketplace.json` + `plugin.json` — plugin identity; validated by zod in CI
2. `skills/<name>/SKILL.md` (≤500 lines) — plan-validate-execute body; templates in `assets/`, scripts in `scripts/`, shared prompts via build-time transclusion
3. `shared/` — cross-skill single sources of truth
4. `hooks/post-write-check-deprecated.json` — PostToolUse hook
5. `generic/` — auto-generated from SKILL.md
6. `examples/confidential-token/` — live reference dApp with smoke-diff CI
7. `scripts/build.mjs` — validate → version sync → transclusion → generic generation

### Critical Pitfalls

1. **Forgot `FHE.allowThis(handle)` after every state-write (A1)** — #1 fhEVM bug. Hard rule in `/zama-contract`; D3 hook catches programmatically.
2. **Emitting deprecated `fhevmjs`/`fhevm` (A8/B5)** — training data defaults to them. Without context7 + D3 hook, skills propagate dead code.
3. **Mock tests pass, Sepolia reverts (A4/A7)** — mocks don't enforce HCU 20M/tx or async decrypt. `/zama-test` must emit two tiers; example dApp is real-network proof.
4. **Demo broken on clean machine (C2)** — env wiring, MetaMask, Node version. Mandatory clean-VM test in final 24h.
5. **README fails 30-second scan (C1)** — hero + install + demo + live URLs above the fold.

## Implications for Roadmap

### Phase 1: Skeleton + Manifests + CI (Day 1)
**Rationale:** Schema errors are silent install failures — judge never sees skills. CI green from day 1 or never.
**Delivers:** Valid `plugin.json` + `marketplace.json`; installable SKILL.md skeletons with required frontmatter; manifest validation (zod); CI; `docs/SUBMISSION.md`.
**Avoids:** B1, B3, B4, C4, C6

### Phase 2: Shared Infrastructure (Day 1-2)
**Rationale:** Writing skill bodies before transclusion = retrofitting all 5. Cheap to build now, expensive later.
**Delivers:** `shared/pinned-versions.json`; `shared/context7-query.md`; `shared/deprecated-imports.json`; `shared/prompts/`; `scripts/build.mjs` transclusion engine; `scripts/sync-versions.mjs`; licensing policy.
**Avoids:** A8, B2, B5, C5

### Phase 3: `/zama-init` End-to-End (Day 2-4) — CRITICAL PATH
**Rationale:** T6 is load-bearing. All other skills assume its output structure.
**Delivers:** Complete `skills/zama-init/SKILL.md`; `scaffold.mjs`; `assets/token/` + `assets/custom/` templates; `.env.example`; MetaMask deep-link; closing summary. Manual smoke test passing.
**Avoids:** A8, B5, B6

### Phase 4: Other 4 Skills (Day 4-5)
**Rationale:** All depend on Phase 3. Build order: `/zama-contract` → `/zama-test` → `/zama-deploy` → `/zama-frontend`.
**Delivers:** Each skill with hard FHE rules (allowThis, HCU budget, leakage); two-tier test; live address fetch + Registry registration; useDecrypted hook + SepoliaConfig.
**Avoids:** A1-A6, B6

### Phase 5: Reference Example dApp (Day 5-6)
**Rationale:** Hand-curated gold standard + final real-Sepolia integration test. Only real deploy proves HCU + async decrypt work.
**Delivers:** `examples/confidential-token/` deployed on Sepolia + Vercel frontend with live URL; `.gsd-snapshot.json`; smoke-diff CI.
**Avoids:** A4, A7, C2

### Phase 6: Distribution Polish + Submission (Day 6-7)
**Rationale:** Cosmetic + distribution-final work only.
**Delivers:** `generic/*.md` auto-generated + CI-enforced; `bin/install.mjs`; cilalı README; D3 anti-deprecated hook (P2); license audit; npm publish; submission ≥24h before deadline.
**Avoids:** C1-C7

### Phase Ordering Rationale

- Manifests before bodies: schema error = install failure
- Shared before bodies: retrofitting 5 skills is 5x the pain
- `/zama-init` before other 4: they assume its output structure
- All 5 skills before example: example is the result
- Example before README polish: README leads with live URLs

### Research Flags

**Needs deeper research at planning time:**
- Phase 3 — Auction variant templates: query context7 `/zama-ai/fhevm` topic="auction" at phase-start
- Phase 4 (`/zama-deploy`) — Confidential Token Registry registration API call signature; WebFetch live
- Phase 5 — Sepolia RPC rate limits, faucet availability, Vercel build compatibility — empirical, allocate buffer

**Standard patterns (skip extra research):**
- Phase 1: Anthropic plugin docs unambiguous
- Phase 2: Versions locked, build tooling standard
- Phase 6: npm publish, GitHub Actions, README well-documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Layer B versions verified via `npm view` 2026-05-03 + cross-checked against template; deprecation notices verified; Layer A verified against Anthropic docs |
| Features | HIGH | Table stakes verified against Anthropic skills + obra/superpowers + shadcn; pain points verified via Zama community forum |
| Architecture | HIGH | Repo layout verified against obra/superpowers + claude-plugins-official; spec + path resolution verified |
| Pitfalls | HIGH (A1-A8, B1-B6) / MEDIUM-HIGH (C1-C7) | fhEVM pitfalls traceable to verbatim Zama docs in context7; bounty pitfalls extrapolated (no public Season 2 rubric) |

**Overall confidence: HIGH**

### Gaps to Address

- Confidential Token Registry registration API: query live at Phase 4 build time
- OZ Confidential Contracts current license: verify before bundling snippets
- Voting/auction variant completeness: token + custom minimum; voting/auction stretch
- Bounty submission form exact fields: capture in Phase 1 `docs/SUBMISSION.md`
- fhevm-react-template sub-package internals (Vite vs Next.js): verify at `/zama-init` time

## Sources

**Primary (HIGH):** npm registry 2026-05-03; live `fhevm-hardhat-template/package.json`; Anthropic skills + plugin-marketplaces + best-practices; context7 `/zama-ai/fhevm` (1772), `/websites/openzeppelin_confidential-contracts` (354), `/zama-ai/fhevm-hardhat-template` (43).

**Secondary:** `obra/superpowers`; `zama-ai/fhevm-react-template`; Zama community forum; shadcn/ui Skills; masonjames/Shadcnblocks-Skill.

**Tertiary (validate at impl):** Sepolia addresses page (live, not pinned); OZ Confidential Contracts current LICENSE; fhevm-react-template sub-package internals.

---
*Research completed: 2026-05-03*
*Ready for roadmap: yes*
