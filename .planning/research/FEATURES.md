# Feature Research

**Domain:** AI agent skill package + Zama fhEVM zero-to-deploy scaffolder (two-axis: skill packaging best practices + dApp tooling delight)
**Researched:** 2026-05-03
**Confidence:** HIGH for skill-packaging patterns (Anthropic docs + obra/superpowers + shadcn skill verified); MEDIUM-HIGH for fhEVM scaffolder gaps (template README + community forum verified, but real user count is small so we're inferring pain points partly from analogous dApp tooling).

> **Two research axes feed this file.**
> Axis A — *What makes a Claude Code skill package exceptional?* (obra/superpowers, shadcn skill, ComposioHQ/awesome-claude-skills, Anthropic skills docs)
> Axis B — *What does fhevm-react-template alone leave on the table?* (env wiring, MetaMask network add, ACL pattern enforcement, anti-deprecated-package guard, registry registration, decrypt UX)
> Each skill below is graded on both axes.

---

## Feature Landscape

### Table Stakes (Users Expect These — missing = "half-baked submission")

> The judging panel for Bounty Track will install the plugin and run `/zama-init`. If any of these are absent or broken, the submission reads as a sketch.

| # | Feature | Why Expected | Complexity | Notes |
|---|---------|--------------|------------|-------|
| T1 | **One-line install** — `/plugin marketplace add <repo>` then `/plugin install zama-skills@zama-skills` documented in README hero | Standard for every published Claude Code plugin (anthropics/claude-plugins-official, obra/superpowers, mll-lab all do this). Without it, the README looks unfinished. | S | Cite official docs install snippet verbatim. Add a copyable code block at the very top. |
| T2 | **Valid `plugin.json` + `marketplace.json` schemas** — `name`, `version`, `description`, skills array, semver discipline | Required by Claude Code plugin loader. Schema errors = install fails = judge moves on. | S | Validate with `zod` in CI (already in STACK.md). |
| T3 | **YAML frontmatter on every SKILL.md** with `name`, `description`, `when_to_use`, `argument-hint`, `allowed-tools`, `disable-model-invocation` | These five fields ARE the skill's UX — autocomplete hint, auto-invoke trigger, tool whitelist, side-effect guard. Anthropic docs treat these as the configuration surface. | S | Already specified in STACK.md. Lead description with key use case (≤1536-char combined cap). |
| T4 | **`disable-model-invocation: true` on `/zama-deploy`** | Without this, Claude can autonomously deploy a contract because tests passed. This is THE textbook example Anthropic uses for the flag. | S | Must-have. Also recommended for `/zama-init` if it scaffolds onto an existing dir. |
| T5 | **`allowed-tools` whitelist per skill** | Avoids per-call permission prompts during long workflows. Without it, the user clicks "yes" 30 times during one `/zama-init` run = terrible UX. | S | Whitelist per skill: `/zama-test` gets `Bash(npx hardhat *)`, `/zama-deploy` gets `Bash(npx hardhat run scripts/deploy.ts *)` etc. |
| T6 | **`/zama-init` produces a working dApp end-to-end** — clone or template-fork → install → compile → test pass → local UI runs → counter incremented via encrypted input → decrypted display works | This is the literal core value proposition from PROJECT.md. If a judge hits any error in this chain, submission dies. | L | Must be tested on a clean macOS+Linux VM at least once before submission. Pin every dep. |
| T7 | **Generates code only against current packages** — never `fhevmjs`, never `fhevm` (root pkg), never `ethers@5`, never `hardhat@3` | Both deprecated packages dominate Google search results. A skill that emits `import 'fhevmjs'` is worse than no skill — it propagates dead code. | M | Hard rule in every skill body. Optional: `pre-tool-use` hook that greps generated code and rejects deprecated imports. |
| T8 | **Context7-aware orchestration** — every skill queries `/zama-ai/fhevm`, `/zama-ai/fhevm-hardhat-template`, `/websites/openzeppelin_confidential-contracts` before emitting Solidity/JS | Already the documented differentiator (PROJECT.md). Without it, skills hallucinate. With it, every emitted line is doc-verified. | M | Bake the three context7 IDs into each SKILL.md. Skill instructs Claude to issue the query before writing code. |
| T9 | **README with hero install snippet, 60-second demo GIF/video, badge row, table of skills** | Submission package is judged on README too. Bounty judges look here first. | M | Cf. obra/superpowers, shadcn skills page — both lead with install + visible demo. |
| T10 | **At least one fully-working example dApp** (confidential token deploy on Sepolia + live frontend URL in README) | Already in PROJECT.md requirements. Judges can click and verify. | L | Confidential token + Sepolia + Vercel-deployed UI. Include the contract address and a tx hash. |
| T11 | **`.env` scaffolding with sane defaults** | fhevm-react-template requires manual `.env.local` creation with Alchemy/Infura key + private key. This is the #1 pain point in community forum. `/zama-init` must generate `.env.example` and prompt for fills. | S | Standard scaffold pattern. |
| T12 | **`argument-hint` on every skill** | Surfaces in autocomplete — without it, slash menu looks unprofessional. | S | One-line addition per SKILL.md. |
| T13 | **Generic-markdown rehber per skill** (`generic/cursor.md`, `generic/codex.md`, `generic/gemini.md`) | PROJECT.md requirement. Bounty theme is "AI agent skills" plural — supporting only Claude looks parochial. | M | Same instructions, stripped of Claude-specific frontmatter. ~1 hr per skill once SKILL.md is locked. |

### Differentiators (Turns "nice" into "the one" submission)

> These are where we win the bounty. Each is defensibly novel within the fhEVM tooling space (verified via search — no other skill ships these for fhEVM).

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| D1 | **Context7 live-query as architectural primitive** | Other submissions will likely embed pinned snippets that go stale. Ours queries `/zama-ai/fhevm` (1772 snippets, HIGH reputation) at runtime — code emitted today reflects docs as of today. Concrete, demonstrable technical advantage. | M | Already the #1 strategic decision in PROJECT.md. Demo it in README: show the actual MCP call inside SKILL.md. |
| D2 | **Use-case picker in `/zama-init`** (token / voting / sealed-bid auction / custom) → branches to a specific OZ confidential primitive | fhevm-react-template ships a single `FHECounter.sol`. Branching to `ERC7984`, `VotesConfidential`, or hand-rolled auction with `FHE.le`/`FHE.select` makes the skill feel *intelligent* rather than *templated*. | M | Already in STACK.md "Stack Patterns by Variant." 4 templates × ~150 lines each. |
| D3 | **Anti-deprecated-import guard hook** (PostToolUse hook on Write/Edit that greps for `fhevmjs`, `from "fhevm"`, `ethers@5` imports → blocks + suggests fix) | Concrete safety net beyond instructions. Differentiates "skill that tells you" from "skill that enforces." Demo-able in 30 seconds. | M | Hook + small JS regex script. Bundle in plugin's `hooks/` dir. |
| D4 | **Decrypt-display React pattern bundled** — `useDecrypted(handle)` hook + loading/error UX baked into `/zama-frontend` template | Decryption is async + relayer-mediated. Most Zama tutorials show the contract-side encrypted input but skim the frontend decrypt UX. Polished decrypt UX is the #1 visible "wow" moment. | M | One custom hook + one example component. Reusable across all use-case variants. |
| D5 | **Confidential Token Registry auto-registration in `/zama-deploy`** | Per PROJECT.md, registry registration is a v1 requirement. Most tutorials stop at deploy. Going one step further (deploy → register → verify on Etherscan → print clickable links) is a memorable closing moment. | S-M | Single script that reads the live registry address from docs.zama.org (per STACK.md gotcha #7). |
| D6 | **`/zama-test` with encrypted-input mocking helpers** that print human-readable assertions ("expected balance to decrypt to 100, got 95") | Hardhat fhEVM plugin gives the primitives but not the assertion sugar. A small `expectDecrypted(handle).toEqual(100n)` helper makes test output legible. | M | ~50 LOC chai matcher extension, bundled in plugin. |
| D7 | **`${CLAUDE_SKILL_DIR}` referenced templates** (so contract scaffolds, frontend snippets, deploy script live as files Claude copies, not as inline literals in SKILL.md) | Two wins: (a) SKILL.md stays under the 500-line guideline, (b) templates are reviewable/editable as plain Solidity & TS files in repo. Standard progressive-disclosure pattern. | M | Already implied by STACK.md layout. Worth calling out as a feature in README. |
| D8 | **MetaMask network-add deep-link** generated in scaffold output (`https://chainid.network/?...`) so user clicks once instead of pasting RPC manually | Tiny detail, big "wow." Direct response to the #2 pain point in the community forum. | S | Generate URL in `/zama-init` final summary. |
| D9 | **`gain`-style summary at end of each skill run** — "Generated 3 files, ran 5 commands, deployed 1 contract. Tx: 0x… Frontend: https://…" | Closing recap = professional polish. Models the GSD/RTK style of structured returns. | S | One template-string at end of each SKILL.md flow. |
| D10 | **Plugin-level marketplace entry that bundles ALL 5 skills + hooks + templates** (single install gives entire toolkit, not 5 separate installs) | Distribution as a *plugin* not a *skill collection* is the modern pattern (Anthropic docs 2026). One `/plugin install` = full kit. | S | Already in STACK.md layout. |
| D11 | **A short (≤90s) README demo video** of `/zama-init` → working confidential token | obra/superpowers + shadcn skill both lead with visual demos. Most fhEVM repos do not. Differentiator on first impression. | M | Recording + edit, ~3 hrs. |
| D12 | **Unique, honest "sources & confidence" footer in each generated file** (cite which context7 snippet was the source) | Reinforces the anti-hallucination claim with receipts. Few skills do this. | S | One-line append per generated file. |

### Anti-Features (Commonly Tempting, Deliberately NOT Built)

| # | Feature | Why Tempting | Why Problematic | Alternative |
|---|---------|--------------|-----------------|-------------|
| A1 | **Custom MCP server for Zama docs** | "Real engineering," fits the bounty theme superficially | Reinvents `/zama-ai/fhevm` (1772 snippets, HIGH reputation in context7). 7-day timeline kills it. Per PROJECT.md decision. | Use context7 MCP directly inside SKILL.md instructions (D1). |
| A2 | **Mainnet deploy automation** | Looks impressive | Audit gap, regulatory risk (confidential token = financial), one bug in skill = real funds lost. Out of scope per PROJECT.md. | Sepolia only. Print a clear "mainnet not supported in v1" guard in `/zama-deploy`. |
| A3 | **`/zama-audit` (FHE-aware code review)** | High judge appeal | Mid-level FHE expertise + 7 days = mediocre review skill that confidently mis-flags. Damages credibility of the rest of the package. | Defer to v2 (PROJECT.md). Mention as "roadmap" in README. |
| A4 | **`/zama-debug` (FHE error diagnostician)** | Useful in principle | Same expertise/time problem. FHE error messages are non-trivial to map to root causes. | Defer to v2. Link to community forum + docs in README troubleshooting section instead. |
| A5 | **Native `.cursorrules` / `.gemini` integrations** | Broader reach | Each native format = its own quirks. 3 platforms shallow vs 1 deep + portable markdown bridge = better submission quality. | Generic markdown per skill (T13). |
| A6 | **Hardhat 3 support** | "Latest version" appeal | fhevm-plugin peer-dep is `hardhat@^2.0.0`. Generating Hardhat 3 configs = installs fail = skill is broken. | Pin Hardhat 2.28.4 (STACK.md). Add explicit guard: skill warns if user already has Hardhat 3 installed. |
| A7 | **`viem`-first frontend** | Modern, type-safe | Zama's own examples + relayer-sdk docs are all ethers v6. Inconsistency confuses users mid-learn. | Ethers v6 primary. Mention viem as "alternative" in `/zama-frontend` body. |
| A8 | **In-skill mainnet ABI verification / source code publishing** | "Production-ready" feel | Etherscan API key flow + plugin verification edge cases are a rabbit hole. | Sepolia Etherscan verify only via `@nomicfoundation/hardhat-verify` (already in STACK.md). |
| A9 | **Bundling a custom fhEVM RPC node / local devnet** | "Batteries included" | Hardhat fhEVM plugin already mocks FHE locally. Running a real local FHE node = >1 GB image, 10-min install, judge dies of impatience. | Use plugin's mock mode for `/zama-test`. Sepolia for end-to-end. |
| A10 | **A "general dApp" use-case branch** (i.e., non-confidential ERC20) | Easy win | Defeats the entire point. Bounty is *Zama Protocol*. If user wants plain ERC20 they should use Scaffold-ETH 2. | `/zama-init` refuses non-confidential templates and explains why. |
| A11 | **Custom skill-side LLM prompt orchestration / agent loops inside SKILL.md** | "Agentic" sounds cool | Claude Code already orchestrates. Adding meta-loops in markdown = reinventing scheduler badly. | Trust Claude Code's loop. Use `context: fork` + `agent: Explore` for `/zama-init` only. |
| A12 | **Comprehensive contract security audit checklist embedded in `/zama-contract`** | "Safe by default" | Confused with `/zama-audit`. Either we ship audit (A3 says no) or we don't half-ship it. Half-shipping is worse. | Link to OZ Confidential Contracts docs + 1 paragraph "common pitfalls" only. |
| A13 | **Auto-publish to npm / auto-PR generation** as part of skill flow | Cool DX | Side-effects + auth = 1-day rabbit hole + judge can't verify it. | Print the commands. Let the user run them. |

---

## Feature Dependencies

```
T1 (one-line install)
    └─requires─> T2 (valid plugin.json/marketplace.json schemas)
                     └─requires─> T3 (frontmatter on every SKILL.md)

T6 (working end-to-end /zama-init)
    └─requires─> T7 (current packages only)
    └─requires─> T11 (.env scaffolding)
    └─requires─> T8 (context7 orchestration)
    └─requires─> D2 (use-case picker — drives which template)
    └─requires─> D7 (templates as files via ${CLAUDE_SKILL_DIR})

T10 (working example dApp in README)
    └─requires─> T6 (which requires the chain above)
    └─requires─> /zama-deploy actually working
    └─requires─> D5 (registry registration)
    └─requires─> D4 (decrypt UX in frontend)

T13 (generic markdown rehber)
    └─requires─> all 5 SKILL.md files locked first

D3 (anti-deprecated hook)
    └─enhances─> T7 (programmatic enforcement of the manual rule)

D9 (closing summary)
    └─enhances─> T6, /zama-deploy, /zama-test (any skill that does work)

D11 (demo video)
    └─requires─> T6 + T10 finished and stable
```

### Dependency Notes

- **T6 is the load-bearing feature.** Everything in the README, every demo, every judge interaction routes through `/zama-init` working end-to-end. Treat T6 as the critical path; everything else slips before T6 does.
- **T2 → T1:** Schema bugs = silent install failure. Validate schemas in CI (zod, per STACK.md) before any other CI gate.
- **D2 (use-case picker) is the bridge between "template clone" and "intelligent scaffolder."** Without it, `/zama-init` is just `git clone` with extra steps. With it, the skill has identity.
- **D5 (registry registration) only matters if T6 succeeds first.** Build T6 → `/zama-deploy` happy path → then add D5 on top.
- **T13 (generic markdown) is parallelizable** — can be done by stripping frontmatter from finished SKILL.md files, no extra design. Save for day 6-7.

---

## MVP Definition

> Deadline: 2026-05-10 (7 days). Ship-or-die scoping.

### Launch With (v1 — submission)

**Day 1-2:**
- [ ] T2 — Valid `plugin.json` + `marketplace.json` (foundation)
- [ ] T3 — Frontmatter on all 5 SKILL.md files (skeletons)
- [ ] T8 — Context7 orchestration baked into each SKILL.md
- [ ] T7 — Anti-deprecated rules in every skill body

**Day 2-4:**
- [ ] T6 — `/zama-init` end-to-end working (the heart)
- [ ] D2 — Use-case picker (token + custom minimum; voting + auction stretch)
- [ ] D7 — Templates as files via `${CLAUDE_SKILL_DIR}`
- [ ] T11 — `.env.example` scaffolding
- [ ] T4 — `disable-model-invocation: true` on `/zama-deploy`
- [ ] T5 — `allowed-tools` whitelists per skill
- [ ] T12 — `argument-hint` on every skill

**Day 4-5:**
- [ ] `/zama-contract`, `/zama-test`, `/zama-deploy`, `/zama-frontend` skills implemented (each calls into context7 + emits from templates)
- [ ] D5 — Confidential Token Registry registration in `/zama-deploy`
- [ ] D4 — Decrypt-display React hook bundled in `/zama-frontend`
- [ ] D8 — MetaMask deep-link in `/zama-init` final output

**Day 5-6:**
- [ ] T10 — Example dApp deployed to Sepolia + Vercel (live URL)
- [ ] T1 — README with one-line install at top + table of skills
- [ ] T9 — Polished README structure (hero, demo, install, skills table, troubleshooting)
- [ ] D9 — Closing summary at end of each skill flow
- [ ] D10 — Plugin-level bundling (already structural)

**Day 6-7:**
- [ ] T13 — Generic markdown rehber per skill (`generic/*.md`)
- [ ] D1 — Make context7 architecture explicit + visible in README (sell the differentiator)
- [ ] D11 — README demo video (≤90s)
- [ ] D3 — Anti-deprecated-import hook (if time)
- [ ] Manual end-to-end test on clean VM
- [ ] Submit

### Add After Validation (v1.x — post-submission polish)

- [ ] D6 — Chai matcher sugar for encrypted-input assertions in `/zama-test`
- [ ] D12 — Source-citation footer on generated files (small but compounds trust)
- [ ] More use-case variants in D2 (NFT, DAO treasury)
- [ ] `npx zama-skills install` CLI fallback (per STACK.md) — useful only if marketplace install proves friction

### Future Consideration (v2 — out of scope for bounty)

- [ ] `/zama-audit` (FHE-aware review) — needs deeper FHE expertise
- [ ] `/zama-debug` (error diagnostician) — needs corpus of real fhEVM errors
- [ ] Native Cursor `.cursorrules` integration
- [ ] Mainnet support
- [ ] Custom MCP server (only if context7 proves insufficient — currently it's not)

---

## Feature Prioritization Matrix

| # | Feature | User Value | Implementation Cost | Priority |
|---|---------|------------|---------------------|----------|
| T6 | `/zama-init` end-to-end works | HIGH | HIGH | P1 |
| T8 | Context7 orchestration | HIGH | MEDIUM | P1 |
| T1 | One-line install | HIGH | LOW | P1 |
| T2 | Valid schemas | HIGH | LOW | P1 |
| T3 | Frontmatter complete | HIGH | LOW | P1 |
| T4 | `disable-model-invocation` on deploy | HIGH | LOW | P1 |
| T5 | `allowed-tools` whitelists | MEDIUM | LOW | P1 |
| T7 | Current packages only | HIGH | LOW | P1 |
| T9 | Polished README | HIGH | MEDIUM | P1 |
| T10 | Example dApp live | HIGH | MEDIUM | P1 |
| T11 | `.env` scaffolding | MEDIUM | LOW | P1 |
| T12 | `argument-hint` everywhere | LOW | LOW | P1 |
| T13 | Generic markdown rehber | MEDIUM | MEDIUM | P1 |
| D1 | Context7 architecture explicit (sold) | HIGH | LOW | P1 |
| D2 | Use-case picker | HIGH | MEDIUM | P1 |
| D4 | Decrypt UX baked in | HIGH | MEDIUM | P1 |
| D5 | Registry registration | MEDIUM | LOW | P1 |
| D7 | Templates as files | MEDIUM | MEDIUM | P1 |
| D8 | MetaMask deep-link | MEDIUM | LOW | P1 |
| D9 | Closing summary | MEDIUM | LOW | P1 |
| D10 | Plugin-level bundling | HIGH | LOW | P1 |
| D11 | README demo video | HIGH | MEDIUM | P2 |
| D3 | Anti-deprecated hook | MEDIUM | MEDIUM | P2 |
| D6 | Chai matcher sugar | MEDIUM | MEDIUM | P2 |
| D12 | Source-citation footer | LOW | LOW | P3 |

**Priority key:** P1 = ship for submission · P2 = ship if time · P3 = post-submission polish

---

## Competitor Feature Analysis

> "Competitors" here = (a) other plausible Zama bounty submissions, (b) analogous "scaffold X" Claude Code skills.

| Feature | obra/superpowers | shadcn skill | Next-Supabase-Vercel bundle | fhevm-react-template (raw) | **zama-skills (us)** |
|---------|------------------|--------------|-----------------------------|----------------------------|---------------------|
| One-line plugin install | Yes | Yes | Yes | N/A (not a skill) | **Yes (T1)** |
| Use-case picker / variants | Implicit (subagent dispatch) | Yes (block catalog) | Limited (Next + Supabase fixed) | No (single counter contract) | **Yes (D2: token/voting/auction/custom)** |
| Live docs query (anti-stale) | No (curated bundled patterns) | Yes (`shadcn info --json` + `add` CLI) | No | No | **Yes (D1: context7 to /zama-ai/fhevm)** |
| Anti-deprecated-import enforcement | No | N/A | No | No | **Yes (D3 hook)** |
| Bundled scripts via `${CLAUDE_SKILL_DIR}` | Yes | Yes | Yes | N/A | **Yes (D7)** |
| Decrypt / domain-specific UX patterns | N/A | Yes (a11y patterns) | Yes (auth flow) | No (counter only) | **Yes (D4: useDecrypted)** |
| Closing summary recap | Yes (TDD/debug recipe ends) | Yes (install confirmation) | Yes | N/A | **Yes (D9)** |
| Generic markdown bridge for non-Claude agents | Yes (Cursor/Codex/Copilot CLI) | Partial | No | N/A | **Yes (T13)** |
| Demo video in README | Yes | Yes | Some | No | **Plan: yes (D11)** |
| Side-effect guard (`disable-model-invocation`) | Yes (selective) | N/A | Partial | N/A | **Yes (T4 on /zama-deploy)** |
| Live deployed example | Some | Yes | Yes | Yes (counter UI) | **Yes (T10: confidential token)** |
| Registry / external service registration | No | No | Partial (Supabase auth) | No | **Yes (D5: Confidential Token Registry)** |

**Read of the table:** No existing Claude Code skill in the search results combines (a) live-docs orchestration via context7, (b) FHE-domain decrypt UX, (c) a registry-registration finishing move, and (d) the anti-deprecated guard. That intersection is our defensible space.

---

## Sources

**Authoritative (HIGH confidence):**
- [Anthropic — Extend Claude with skills](https://code.claude.com/docs/en/skills) — frontmatter, `disable-model-invocation`, `allowed-tools`, progressive disclosure
- [Anthropic — Skill authoring best practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices) — 500-line SKILL.md guideline, one-skill-per-task rule
- [Anthropic — Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) — `marketplace.json` schema, install commands
- [zama-ai/fhevm-react-template](https://github.com/zama-ai/fhevm-react-template) — what the raw template provides + what it leaves manual
- [Zama community forum — Vercel deploy errors thread](https://community.zama.org/t/error-when-testing-the-fhevm-react-demo-on-vercel/2959/5) — real pain points (env wiring, MetaMask cache)

**MEDIUM-HIGH confidence (curated lists, individual skill repos verified):**
- [obra/superpowers](https://github.com/obra/superpowers) — README patterns, multi-platform install, philosophy section, subagent-driven-development
- [shadcn/ui Skills page](https://ui.shadcn.com/docs/skills) — project intelligence pattern (`shadcn info --json`), CLI orchestration
- [masonjames/Shadcnblocks-Skill](https://github.com/masonjames/Shadcnblocks-Skill) — block-catalog selection pattern (analogous to D2 use-case picker)
- [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) + [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) + [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — survey of what community skills ship
- [DevelopersIO — disable-model-invocation walkthrough](https://dev.classmethod.jp/en/articles/disable-model-invocation-claude-code/) — concrete example matching our `/zama-deploy` use case
- [DeepWiki — Progressive Disclosure Pattern](https://deepwiki.com/daymade/claude-code-skills/3.3-progressive-disclosure-pattern) — three-level loading rationale
- [Towards Data Science — production-ready Claude Code skill](https://towardsdatascience.com/how-to-build-a-production-ready-claude-code-skill/) — plan-validate-execute pattern
- [christianestay/claude-code-base-project](https://github.com/christianestay/claude-code-base-project) — anti-hallucination layers in scaffold templates (analogous to our D3)

**Cross-reference (already in STACK.md):**
- npm registry queries for `@fhevm/*`, `@zama-fhe/*`, `@openzeppelin/confidential-contracts` versions (2026-05-03)
- PROJECT.md scope decisions (audit/debug deferred, mainnet out, context7 chosen over MCP)

---
*Feature research for: zama-skills (Claude Code skill package + fhEVM zero-to-deploy scaffolder)*
*Researched: 2026-05-03*
