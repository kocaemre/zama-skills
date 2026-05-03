# Architecture Research

**Domain:** Claude Code plugin (skills) + npm CLI dual distribution + reference example dApp
**Researched:** 2026-05-03
**Confidence:** HIGH for skill-package layout (verified against obra/superpowers, anthropics official plugins, shadcn skill, Anthropic skills docs); HIGH for build/publish (standard npm + GitHub mechanics); MEDIUM for examples-vs-skills relationship (a deliberate decision below — both options are defensible, picked one).

> Two layers, one repo. Layer A = the skill package we publish (consumed by Claude Code + via npm). Layer B = the reference example dApp the skills *produce* (consumed by judges + as a fixture by the skills themselves). This document resolves how those two layers cohabit, what shared code exists, and the build order.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Distribution Surface                          │
├─────────────────────────────────────────────────────────────────────┤
│   GitHub repo (canonical)                                            │
│   ├─ /plugin marketplace add github.com/<owner>/zama-skills          │
│   └─ /plugin install zama-skills@zama-skills                         │
│                                                                      │
│   npm registry (fallback / generic-agent users)                      │
│   └─ npx zama-skills install [--scope personal|project]              │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────┐
│                   Layer A — Skill Package (the product)              │
├──────────────────────────────────────────────────────────────────────┤
│   .claude-plugin/marketplace.json   ← top-level marketplace catalog  │
│   plugins/zama-skills/                                               │
│     ├─ .claude-plugin/plugin.json   ← plugin manifest                │
│     ├─ skills/                                                       │
│     │   ├─ zama-init/      SKILL.md + assets/ + scripts/             │
│     │   ├─ zama-contract/  SKILL.md + assets/ + scripts/             │
│     │   ├─ zama-test/      SKILL.md + assets/ + scripts/             │
│     │   ├─ zama-deploy/    SKILL.md + assets/ + scripts/             │
│     │   └─ zama-frontend/  SKILL.md + assets/ + scripts/             │
│     ├─ shared/             ← ⚡ cross-skill helpers (see §3)         │
│     │   ├─ context7-query.md     (prompt fragment, included verbatim)│
│     │   ├─ pinned-versions.json  (single source of truth for versions)│
│     │   ├─ deprecated-imports.json (banlist for D3 hook)             │
│     │   └─ scripts/                                                   │
│     │       ├─ check-deprecated.mjs  (hook target)                   │
│     │       └─ sync-versions.mjs     (build-time injection)          │
│     └─ hooks/                                                         │
│         └─ post-write-check-deprecated.json                          │
│   generic/              ← markdown rehber for non-Claude agents       │
│     ├─ README.md  (how to use these with Cursor/Codex/Gemini)        │
│     ├─ zama-init.md   ← AUTO-GENERATED from skills/zama-init/SKILL.md │
│     ├─ zama-contract.md  ← AUTO-GENERATED                            │
│     ├─ zama-test.md      ← AUTO-GENERATED                            │
│     ├─ zama-deploy.md    ← AUTO-GENERATED                            │
│     └─ zama-frontend.md  ← AUTO-GENERATED                            │
│   bin/install.mjs       ← npx zama-skills install entrypoint         │
│   scripts/                                                            │
│     ├─ generate-generic.mjs   (SKILL.md → generic/*.md transform)    │
│     ├─ validate-manifests.mjs (zod schemas for plugin/marketplace)   │
│     └─ build.mjs              (orchestrates: validate → generate)    │
│   test/                                                               │
│     ├─ schemas.test.ts        (manifest validation)                  │
│     ├─ install-cli.test.ts    (npx flow on a tmp dir)                │
│     └─ skill-fixtures/        (golden SKILL.md inputs/outputs)       │
│   package.json                                                        │
│   README.md                                                           │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ skills produce ↓
┌──────────────────────────────────▼──────────────────────────────────┐
│                Layer B — Reference Example dApp (output)             │
├──────────────────────────────────────────────────────────────────────┤
│   examples/                                                          │
│     └─ confidential-token/    ← canonical hand-curated example       │
│         ├─ contracts/         (ERC7984 token)                        │
│         ├─ test/              (with /zama-test patterns)             │
│         ├─ deploy/            (with /zama-deploy registry script)    │
│         ├─ frontend/          (Vite + relayer-sdk + useDecrypted)    │
│         ├─ README.md          (live Sepolia addr + Vercel URL)       │
│         └─ .gsd-snapshot.json (records: what /zama-init produced)    │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ orchestration ↓
┌──────────────────────────────────▼──────────────────────────────────┐
│                  External Dependencies (runtime, not bundled)        │
├──────────────────────────────────────────────────────────────────────┤
│   context7 MCP  →  /zama-ai/fhevm                                    │
│                    /zama-ai/fhevm-hardhat-template                   │
│                    /websites/openzeppelin_confidential-contracts     │
│   docs.zama.org →  Sepolia addresses (queried at runtime, not pinned)│
│   GitHub API    →  fhevm-react-template (cloned by /zama-init)       │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Owns | Talks To |
|-----------|------|----------|
| `.claude-plugin/marketplace.json` | Marketplace listing (one entry: zama-skills plugin) | Claude Code marketplace loader |
| `plugins/zama-skills/.claude-plugin/plugin.json` | Plugin identity (name, version, description) | Claude Code plugin loader |
| `skills/<name>/SKILL.md` | Frontmatter + plan-validate-execute body for one workflow | `shared/`, `${CLAUDE_SKILL_DIR}/scripts/`, context7 MCP |
| `skills/<name>/assets/` | Hand-edited Solidity/TS templates copied verbatim into user repo | (read by skill body via `${CLAUDE_SKILL_DIR}`) |
| `skills/<name>/scripts/` | Skill-specific runtime scripts (e.g., scaffold-from-template.mjs) | Local fs only |
| `shared/pinned-versions.json` | Single source of truth for fhEVM stack versions (Layer B) | All 5 skills (read-only); `scripts/build.mjs` (writes into examples/) |
| `shared/context7-query.md` | Reusable prompt fragment: "Before writing FHE code, query these 3 sources..." | Every SKILL.md (transcluded at build time) |
| `shared/deprecated-imports.json` | Banlist: `fhevmjs`, `fhevm`, `ethers@5`, `hardhat@3` | `hooks/post-write-check-deprecated.json` |
| `hooks/post-write-check-deprecated.json` | Plugin-level hook config registering check-deprecated.mjs | Claude Code hook system |
| `generic/*.md` | Non-Claude agent equivalent of each skill | (consumers paste into their tool) |
| `bin/install.mjs` | `npx zama-skills install` — copies skills to `~/.claude/skills/` or `.claude/skills/` | Local fs, prompts |
| `scripts/build.mjs` | Validate manifests → inject pinned versions → generate generic/*.md | Everything in `shared/` and `skills/` |
| `examples/confidential-token/` | Live reference dApp judges can run | Sepolia testnet, Vercel |

---

## Recommended Project Structure (Annotated)

```
zama-skills/
├── .claude-plugin/
│   └── marketplace.json              # 1 marketplace, 1 plugin entry
│
├── plugins/
│   └── zama-skills/                  # the plugin (singular — bundles all 5 skills)
│       ├── .claude-plugin/
│       │   └── plugin.json           # name=zama-skills, version, skills[], hooks[]
│       │
│       ├── skills/                   # one folder per skill, dir name = frontmatter name
│       │   ├── zama-init/
│       │   │   ├── SKILL.md          # ≤500 lines (Anthropic best practice)
│       │   │   ├── assets/           # template files copied verbatim
│       │   │   │   ├── token/        ├─ ERC7984 variant
│       │   │   │   ├── voting/       ├─ VotesConfidential variant
│       │   │   │   ├── auction/      ├─ hand-rolled sealed-bid variant
│       │   │   │   └── custom/       └─ minimal counter starter
│       │   │   └── scripts/
│       │   │       └── scaffold.mjs  # fork react-template + apply variant
│       │   │
│       │   ├── zama-contract/
│       │   │   ├── SKILL.md
│       │   │   ├── assets/
│       │   │   │   ├── snippets/     # copy-pasteable euint/ACL snippets
│       │   │   │   └── checklist.md  # "common pitfalls" reference
│       │   │   └── (no scripts — pure code-gen via Claude)
│       │   │
│       │   ├── zama-test/
│       │   │   ├── SKILL.md
│       │   │   ├── assets/
│       │   │   │   ├── hardhat.config.template.ts
│       │   │   │   └── test-patterns/  # encrypted-input mocking examples
│       │   │   └── scripts/
│       │   │       └── expect-decrypted.mjs   # D6 chai matcher (P2)
│       │   │
│       │   ├── zama-deploy/
│       │   │   ├── SKILL.md          # disable-model-invocation: true
│       │   │   ├── assets/
│       │   │   │   ├── deploy.template.ts
│       │   │   │   └── verify.template.ts
│       │   │   └── scripts/
│       │   │       ├── fetch-sepolia-addrs.mjs   # live registry lookup
│       │   │       └── register-token.mjs         # D5 registry registration
│       │   │
│       │   └── zama-frontend/
│       │       ├── SKILL.md
│       │       ├── assets/
│       │       │   ├── hooks/useDecrypted.ts      # D4 decrypt hook
│       │       │   ├── components/EncryptedInput.tsx
│       │       │   ├── components/DecryptedDisplay.tsx
│       │       │   └── pages/                     # variant-specific pages
│       │       └── scripts/
│       │           └── inject-relayer-config.mjs  # writes .env with relayer URL
│       │
│       ├── shared/                   # cross-skill code (single source of truth)
│       │   ├── context7-query.md     # transcluded into every SKILL.md at build
│       │   ├── pinned-versions.json  # Layer B versions — bumped here, propagates
│       │   ├── deprecated-imports.json
│       │   ├── prompts/
│       │   │   ├── anti-deprecation.md   # transcluded fragment
│       │   │   ├── closing-summary.md    # D9 recap template
│       │   │   └── source-citation.md    # D12 footer template (P3)
│       │   └── scripts/
│       │       ├── check-deprecated.mjs  # hook implementation
│       │       └── shared-utils.mjs      # logging, color, fs helpers
│       │
│       └── hooks/
│           └── post-write-check-deprecated.json  # registers PostToolUse hook
│
├── generic/                          # AUTO-GENERATED — do not hand-edit
│   ├── README.md                     # explains how to use with Cursor/Codex/Gemini
│   ├── zama-init.md                  # ← from plugins/.../skills/zama-init/SKILL.md
│   ├── zama-contract.md              # ← from .../zama-contract/SKILL.md
│   ├── zama-test.md
│   ├── zama-deploy.md
│   └── zama-frontend.md
│
├── examples/                         # Layer B — reference output
│   └── confidential-token/           # ONE canonical example for v1
│       ├── contracts/
│       ├── test/
│       ├── deploy/
│       ├── frontend/
│       ├── README.md                 # Sepolia address + Vercel URL
│       └── .gsd-snapshot.json        # metadata: which skills produced this, when
│
├── bin/
│   └── install.mjs                   # npx zama-skills install entrypoint
│
├── scripts/
│   ├── build.mjs                     # validate → sync-versions → generate-generic
│   ├── validate-manifests.mjs        # zod schemas for plugin.json + marketplace.json
│   ├── generate-generic.mjs          # SKILL.md → generic/<name>.md (strips frontmatter)
│   ├── sync-versions.mjs             # shared/pinned-versions.json → assets/**/package.json
│   └── publish.mjs                   # prepublish gate: build + test + manifest-check
│
├── test/
│   ├── schemas.test.ts               # plugin.json + marketplace.json shapes
│   ├── frontmatter.test.ts           # all SKILL.md have required frontmatter fields
│   ├── install-cli.test.ts           # npx flow: copies to tmp ~/.claude/skills/ correctly
│   ├── generic-sync.test.ts          # generic/*.md regenerates deterministically
│   ├── version-sync.test.ts          # all assets/package.json match shared/pinned-versions.json
│   ├── deprecated-guard.test.ts      # hook script catches `import 'fhevmjs'` etc.
│   └── fixtures/
│       └── tmp-skill-install/        # sandbox for install-cli tests
│
├── docs/
│   ├── ARCHITECTURE.md               # this file (copied to docs at publish)
│   ├── CONTRIBUTING.md
│   └── images/                       # README hero, demo GIF
│
├── .github/workflows/
│   ├── ci.yml                        # validate + test on push
│   └── publish.yml                   # npm publish on tag
│
├── package.json                      # bin field → bin/install.mjs; files[] whitelist
├── README.md                         # one-line install hero, demo, skills table
├── LICENSE
└── .gitignore
```

### Structure Rationale

- **`.claude-plugin/marketplace.json` at root, plugins/ nested:** Required by Claude Code plugin spec — marketplace loader looks at `.claude-plugin/marketplace.json` first; that file declares `plugins/zama-skills/` as the plugin path. Repo can hold N plugins later without restructuring.
- **`plugins/zama-skills/` (singular plugin holding 5 skills) over 5 separate plugins:** Distribution as one plugin = one install command for the full kit (D10 in FEATURES.md). Five separate plugins would make `/plugin install` a 5-step ceremony.
- **`plugins/zama-skills/shared/` (inside the plugin, not at repo root):** Critical — when a plugin is installed, Claude Code copies the *plugin* directory; anything outside it (like `../shared/`) is not copied. Per STACK.md gotcha #9, relative paths to `../shared` would break post-install. Putting `shared/` *inside* the plugin makes it portable.
- **`assets/` separate from `scripts/` per skill:** `assets/` = static templates copied into user repo (no execution); `scripts/` = runtime tools the skill executes via `${CLAUDE_SKILL_DIR}/scripts/foo.mjs`. Mixing them obscures the trust boundary.
- **`generic/` as auto-generated, not hand-written:** Resolves the duplication concern in the prompt. SKILL.md is the source; generic markdown is a derived artifact. `scripts/generate-generic.mjs` strips the YAML frontmatter and Claude-specific tool references (e.g., rewrites `${CLAUDE_SKILL_DIR}/assets/foo.sol` to a relative repo URL the user can curl). Hand-editing would diverge within a week.
- **`examples/` at repo root, NOT under plugins/:** Examples are not part of what gets installed into `~/.claude/skills/`. They live at repo root so judges browsing GitHub see them immediately. `.gsd-snapshot.json` records "this example was produced by `/zama-init` on 2026-05-08 with use-case=token" — making it both a regression fixture *and* proof of the skill working.
- **`bin/` at repo root (npm convention):** `package.json` `"bin"` field requires this; it is the entrypoint for `npx zama-skills install`.
- **`scripts/` at repo root for build-time, `plugins/.../scripts/` for runtime:** Sharp separation. Build scripts mutate the repo before publish; runtime scripts run on the user's machine.

---

## Component Boundaries (Who Talks to Whom)

```
┌──────────────────────────────────────────────────────────────────┐
│                        Build-time graph                           │
│                                                                   │
│  shared/pinned-versions.json ──┬─→ skills/*/assets/**/package.json│
│                                ├─→ examples/*/package.json        │
│                                └─→ generic/*.md (version notes)   │
│                                                                   │
│  shared/context7-query.md ─────┬─→ skills/*/SKILL.md (transclude) │
│  shared/prompts/*.md ──────────┘                                  │
│                                                                   │
│  skills/*/SKILL.md ────────────→ generic/*.md (strip + transform) │
│                                                                   │
│  scripts/validate-manifests.mjs ─→ marketplace.json + plugin.json │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                        Runtime graph                              │
│                                                                   │
│  /zama-init  ─→ context7 MCP ─→ /zama-ai/fhevm-hardhat-template   │
│              ─→ scripts/scaffold.mjs ─→ user's cwd (creates files)│
│              ─→ assets/<variant>/* (copied to user cwd)           │
│                                                                   │
│  /zama-contract ─→ context7 MCP ─→ /zama-ai/fhevm                 │
│                 ─→ context7 MCP ─→ /websites/openzeppelin_*       │
│                                                                   │
│  /zama-test  ─→ Bash(npx hardhat *)                               │
│              ─→ assets/test-patterns/* (template snippets)        │
│                                                                   │
│  /zama-deploy ─→ scripts/fetch-sepolia-addrs.mjs ─→ docs.zama.org │
│               ─→ scripts/register-token.mjs ─→ Sepolia            │
│               ─→ Bash(npx hardhat run *) [allowed-tools]          │
│                                                                   │
│  /zama-frontend ─→ assets/hooks/useDecrypted.ts (copy)            │
│                 ─→ scripts/inject-relayer-config.mjs              │
│                                                                   │
│  PostToolUse hook (any Write/Edit) ─→ shared/scripts/             │
│                                       check-deprecated.mjs        │
│                                       ─→ reads shared/            │
│                                          deprecated-imports.json  │
└──────────────────────────────────────────────────────────────────┘
```

### Boundary Rules (enforced by tests)

1. **No skill imports another skill's `assets/` or `scripts/`.** Cross-skill code goes in `shared/` or it doesn't exist.
2. **`shared/pinned-versions.json` is the only place version strings appear.** All `assets/**/package.json` are templated; `scripts/sync-versions.mjs` writes them at build. Test (`version-sync.test.ts`) fails CI if any package.json contains a hardcoded `@fhevm/*` version.
3. **SKILL.md files do not duplicate the context7 query instruction.** They `<!-- include: ../../shared/context7-query.md -->` and `scripts/build.mjs` inlines at build time (since SKILL.md does not natively support transclusion). Result: one place to update the 3 context7 source IDs.
4. **`generic/*.md` files are read-only in CI.** `generic-sync.test.ts` regenerates them and diff-checks against committed copies — drift fails the build.
5. **`examples/` is never imported by skills.** Skills produce *new* output for the user; examples are *historical* output the team committed. Wiring would create a circular dep.

### Why Shared Code Exists (the maintenance-nightmare prevention answer)

The prompt called out the risk explicitly: *"5 skills with duplicated logic = maintenance nightmare."* Concrete cases of duplication that `shared/` solves:

| Cross-skill concern | Lives in | Consumed by | Drift cost if duplicated |
|---|---|---|---|
| The 3 context7 source IDs | `shared/context7-query.md` | All 5 SKILL.md (transcluded) | 5 places to update when Zama renames a doc set |
| Version pins for `@fhevm/*`, `@openzeppelin/confidential-contracts`, etc. | `shared/pinned-versions.json` | All 5 skills' `assets/**/package.json`, examples/, generic/*.md notes | When `@fhevm/solidity` ships 0.12, 5 skills + 1 example ship broken installs |
| Deprecated-import banlist | `shared/deprecated-imports.json` | `hooks/check-deprecated.mjs` | If we list `fhevmjs` in 5 skills, we'll forget one when adding `viem-fhevm-legacy` |
| "Closing summary" recap template (D9) | `shared/prompts/closing-summary.md` | All 5 SKILL.md (transcluded) | Style drift = inconsistent UX |
| Anti-deprecation reminder paragraph | `shared/prompts/anti-deprecation.md` | All 5 SKILL.md (transcluded) | Same |
| Source citation footer (D12) | `shared/prompts/source-citation.md` | All 5 SKILL.md (transcluded) | Same |

Build step (`scripts/build.mjs`) resolves transclusion markers (`<!-- include: shared/foo.md -->`) before publish. SKILL.md files in the published artifact are flat (no markers) so Claude Code doesn't need to know about transclusion. The git-tracked SKILL.md *can* contain markers (clean to read); the published one is expanded. Two equally valid options here:

- **Option A (chosen): markers in source, expansion at build.** Pros: source is short, single source of truth. Cons: extra build step.
- **Option B: hand-copy and rely on tests to detect drift.** Pros: no build magic. Cons: humans paste poorly.

Picked A because we already have a build pipeline (manifest validation + generic gen); adding transclusion is one more line.

---

## SKILL.md Internal Structure (Per-Skill Pattern)

Every SKILL.md follows the same 7-part skeleton (HIGH confidence — verified against obra/superpowers TDD skill, shadcn skill, Anthropic best-practices doc). Stays under 500 lines per Anthropic guideline.

```markdown
---
name: zama-contract
description: Generate confidential Solidity contracts using @fhevm/solidity v0.11.x and OpenZeppelin Confidential Contracts v0.4.x. Use when the user asks to write euint variables, FHE.add/sub/mul operations, ACL grants (FHE.allow), encrypted ERC20s (ERC7984), confidential voting (VotesConfidential), or sealed-bid auctions. Skill queries /zama-ai/fhevm and /websites/openzeppelin_confidential-contracts via context7 before emitting code.
when_to_use: User wants to write FHE Solidity, add encrypted state, set ACL permissions, or extend OpenZeppelin Confidential primitives.
argument-hint: "[contract-type: token|voting|auction|custom]"
allowed-tools: Read Write Edit Bash(npx hardhat compile) WebFetch
disable-model-invocation: false
---

## Purpose
[2-4 lines: what this skill does, what it doesn't]

## Pre-flight (MANDATORY before generating any code)
<!-- include: ../../shared/context7-query.md -->
<!-- include: ../../shared/prompts/anti-deprecation.md -->

## Plan
[Plan-validate-execute pattern, per Anthropic best-practices.
 Show the user what you'll do BEFORE doing it.]

## Execute — branching by argument
### If contract-type=token
- Read `${CLAUDE_SKILL_DIR}/assets/snippets/erc7984-skeleton.sol`
- ...
### If contract-type=voting
- ...
### If contract-type=custom
- ...

## Validate
- Run `Bash(npx hardhat compile)` — must pass
- Grep generated code for `fhevmjs`, `from "fhevm"` — must be absent

## Closing summary
<!-- include: ../../shared/prompts/closing-summary.md -->
```

### When to inline vs reference external files

| Content | Inline in SKILL.md | Reference via `${CLAUDE_SKILL_DIR}` |
|---|---|---|
| ≤20-line prompt instruction | ✓ | ✗ |
| Cross-skill prompt (context7 query, anti-deprecation reminder, closing summary) | ✗ | ✓ via transclusion at build |
| Solidity/TS template files (>20 lines) | ✗ | ✓ in `assets/` |
| Variant-specific scaffolds (token vs voting) | ✗ | ✓ in `assets/<variant>/` |
| Runtime scripts (deploy, registry registration) | ✗ | ✓ in `scripts/` |
| ACL pattern explanations | ✗ (link to context7) | ✗ — query live |
| The plan-validate-execute structure | ✓ | ✗ |
| Frontmatter | ✓ (must be) | ✗ |

Rule of thumb: anything Claude *reasons about* lives inline; anything Claude *copies into the user's repo* lives in `assets/`; anything Claude *runs* lives in `scripts/`.

### Progressive Disclosure (3 levels)

1. **Frontmatter description (≤1536 chars combined w/ when_to_use):** Loaded into autocomplete + auto-invoke index. Lead with "what this does, when to call."
2. **SKILL.md body (≤500 lines):** Loaded when skill is invoked. Plan-validate-execute structure with branching.
3. **`assets/` + `scripts/`:** Loaded only when SKILL.md instructs Claude to `Read` them. Keeps token cost flat unless needed.

This is the pattern obra/superpowers and shadcn skill both use. Verified against Anthropic skills docs.

---

## Build / Test / Publish Pipeline

```
                      ┌──────────────────┐
   developer commits  │   git push       │
                      └────────┬─────────┘
                               │
                      ┌────────▼─────────┐
                      │  GH Actions CI   │
                      │  .github/        │
                      │  workflows/ci.yml│
                      └────────┬─────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
  ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
  │ scripts/         │ │ test/        │ │ scripts/build.mjs│
  │ validate-        │ │ vitest run   │ │ (transclusion +  │
  │ manifests.mjs    │ │              │ │  generic gen +   │
  │ (zod)            │ │ - schemas    │ │  version sync)   │
  │                  │ │ - frontmatter│ │                  │
  │ - marketplace.   │ │ - install-cli│ │ Output: clean    │
  │   json shape     │ │ - generic-   │ │ working tree     │
  │ - plugin.json    │ │   sync       │ │ ready to publish │
  │   shape          │ │ - version-   │ │                  │
  │ - all SKILL.md   │ │   sync       │ │ FAILS if         │
  │   have required  │ │ - deprecated │ │ generic/ or      │
  │   frontmatter    │ │   guard      │ │ assets/pkg.json  │
  └──────────────────┘ └──────────────┘ │ have drifted     │
                                        └──────────────────┘
                               │
                       all green? ──→ no ──→ block merge
                               │
                              yes
                               │
                      ┌────────▼─────────┐
                      │ git tag v0.x.y   │
                      │ git push --tags  │
                      └────────┬─────────┘
                               │
                      ┌────────▼─────────────────────┐
                      │ .github/workflows/publish.yml│
                      │  - scripts/publish.mjs        │
                      │     (re-runs build + tests)   │
                      │  - npm publish                │
                      │     (uses package.json files[]│
                      │      whitelist — ships only   │
                      │      bin/, plugins/, generic/,│
                      │      README.md)               │
                      └────────┬─────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│ npm registry │     │ GitHub release │     │ Marketplace  │
│ zama-skills  │     │ (auto from tag)│     │ entry visible│
│              │     │                │     │ to /plugin   │
│ npx zama-    │     │ Judges browse  │     │ marketplace  │
│ skills       │     │ here first     │     │ add ...      │
│ install      │     │                │     │              │
└──────────────┘     └────────────────┘     └──────────────┘
```

### Two install paths, one source of truth

- **`/plugin marketplace add github.com/<owner>/zama-skills`** — Claude Code reads `.claude-plugin/marketplace.json` directly from the GitHub clone. No npm needed. Claude users get this.
- **`npx zama-skills install`** — runs `bin/install.mjs`, which detects scope (personal `~/.claude/skills/` vs project `.claude/skills/`), copies the contents of `plugins/zama-skills/skills/*` into the chosen scope, and prints next steps. For non-Claude-Code users (Cursor, etc.) it points to `generic/*.md` instead.

Both paths ship from the same `plugins/zama-skills/` tree. No duplication, no version skew.

### `package.json` essentials

```json
{
  "name": "zama-skills",
  "version": "0.1.0",
  "type": "module",
  "bin": { "zama-skills": "./bin/install.mjs" },
  "files": [
    "bin/",
    "plugins/",
    "generic/",
    ".claude-plugin/",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "node scripts/build.mjs",
    "test": "vitest run",
    "validate": "node scripts/validate-manifests.mjs",
    "prepublishOnly": "node scripts/publish.mjs"
  },
  "engines": { "node": ">=20" }
}
```

`files[]` whitelist excludes `examples/`, `test/`, `scripts/`, `docs/`, `.github/` — keeps the npm tarball lean (~50KB target). `examples/` is intentionally excluded from npm but stays on GitHub for judges.

### Testing skills without manually triggering them

Three levels:

1. **Schema/frontmatter tests (vitest):** Static parse of every SKILL.md, assert frontmatter fields, assert no `import 'fhevmjs'` in `assets/`. Fast (~1s).
2. **Install-CLI test (vitest + tmp dir):** Spawn `bin/install.mjs` against a tmp `~/.claude/skills/` shim, assert files copied correctly. Catches packaging bugs.
3. **Manual end-to-end (one-time per release):** Fresh VM (macOS + Linux), `/plugin install zama-skills`, run `/zama-init` token, verify deploy + frontend. Cannot automate (Claude Code is interactive). Document the script in `docs/release-checklist.md`.

There is no good way to programmatically test "Claude correctly invokes the skill" — Anthropic does not ship a skill harness as of 2026-05. Manual end-to-end on the critical path (`/zama-init` token variant) is the bar.

---

## Examples vs Skills — Resolved

**Decision:** Examples are **hand-curated gold-standard references** that the skills *aspire to produce* — *not* raw `/zama-init` output dumps.

**Reasoning:**

| Option | Pros | Cons |
|---|---|---|
| Examples = raw skill output | Honest demo | If skill regresses, example regresses; example becomes a flaky regression fixture for the skill, breaking confidence in *both* |
| **Examples = hand-curated gold standard (chosen)** | Stable reference for judges; serves as a regression *target* for the skill ("does `/zama-init` produce something equivalent?") | Slight drift risk — skill output may diverge from example over time |
| Examples = both (snapshot + curated) | Most honest | 7-day timeline kills it |

To mitigate the drift risk: each example carries `.gsd-snapshot.json` recording (a) the skill version that produced the *initial* scaffold, (b) the human edits applied on top, (c) the date. CI runs a "smoke" check that re-runs `/zama-init` headlessly (script-driven, not Claude-driven) against the bundled `assets/` and diffs key files (e.g., `package.json` deps, `hardhat.config.ts` skeleton) against the example. Divergence in deps = CI fails. Divergence in user-facing UI = OK (humans polished it).

**v1 scope:** ONE example — `examples/confidential-token/` — fully working, deployed to Sepolia, frontend on Vercel, README has the live URL + tx hash. Per FEATURES.md T10, this is the load-bearing demo.

**v2 candidates (post-bounty):** `examples/confidential-voting/`, `examples/sealed-bid-auction/`. Same pattern.

---

## Generic Markdown Duplication — Resolved

**Decision:** `generic/*.md` is **auto-generated** from `plugins/zama-skills/skills/*/SKILL.md` via `scripts/generate-generic.mjs`. Hand-edits forbidden (CI enforces).

**Transformation rules (encoded in generate-generic.mjs):**

1. Strip YAML frontmatter (Cursor/Codex/Gemini don't use it).
2. Replace `${CLAUDE_SKILL_DIR}/assets/foo.sol` → `https://raw.githubusercontent.com/<owner>/zama-skills/main/plugins/zama-skills/skills/<skill>/assets/foo.sol` so the user can `curl` it.
3. Replace `${CLAUDE_SKILL_DIR}/scripts/bar.mjs` → inline the script content as a code block (generic agents won't have the script locally).
4. Resolve `<!-- include: shared/foo.md -->` markers (same as Claude build).
5. Replace `Bash(npx hardhat *)` references → plain "Run: `npx hardhat compile`" (generic agents may not parse the allowed-tools syntax).
6. Append a "Where this came from" footer linking back to the SKILL.md on GitHub.

**Why auto-generated, not hand-written:**

- 5 skills × 2 platforms (Claude + generic) × ~300 lines each = 3000 lines hand-maintained. At week 2 someone bumps `@fhevm/solidity` in SKILL.md and forgets to mirror in generic/ → users on Cursor get stale instructions → "skill is broken" tickets.
- Tests (`generic-sync.test.ts`) regenerate generic/ in CI and diff-check against committed files. PR to SKILL.md without regenerating generic/ = CI red. Forces consistency.
- A single `generic/README.md` *is* hand-written: it explains "these are markdown rehbers, paste them into your tool's instruction system." Per-platform notes for Cursor/Codex/Gemini live there (≤30 lines per platform).

---

## Suggested Build Order (Phase Sequencing)

Critical path threads through T6 (working `/zama-init`). Build outward from there. This drives the roadmap phases.

```
Phase 1 — Skeleton + manifests (Day 1)
├─ .claude-plugin/marketplace.json
├─ plugins/zama-skills/.claude-plugin/plugin.json
├─ Empty SKILL.md skeletons for all 5 skills (frontmatter only, valid)
├─ scripts/validate-manifests.mjs + zod schemas
├─ test/schemas.test.ts + frontmatter.test.ts
└─ CI green
   ↓ unblocks: everything else
   Why first: nothing installs if manifests are invalid (FEATURES.md T2 → T1).

Phase 2 — Shared infrastructure (Day 1-2)
├─ shared/pinned-versions.json (paste from STACK.md)
├─ shared/context7-query.md
├─ shared/deprecated-imports.json
├─ shared/prompts/{anti-deprecation,closing-summary}.md
├─ scripts/build.mjs (transclusion engine)
├─ scripts/sync-versions.mjs
└─ test/version-sync.test.ts
   ↓ unblocks: any skill body that wants to transclude
   Why second: writing skill bodies before the transclusion engine = retrofit pain.

Phase 3 — /zama-init end-to-end (Day 2-4) — THE CRITICAL PATH
├─ skills/zama-init/SKILL.md (full body)
├─ skills/zama-init/assets/{token,custom}/* (token + custom variants only for v1 minimum)
├─ skills/zama-init/scripts/scaffold.mjs
├─ Manual smoke test: install plugin → run /zama-init token → see working scaffold
└─ Iterate until clean
   ↓ unblocks: examples/, README demo, validates entire architecture
   Why third: per FEATURES.md "T6 is the load-bearing feature" — every other thing
   is window dressing if /zama-init doesn't work.

Phase 4 — Other 4 skills, in dependency order (Day 4-5)
├─ /zama-contract (no runtime deps; pure code-gen — easy second)
├─ /zama-test (depends on /zama-init output existing — needs T6 done)
├─ /zama-deploy (depends on /zama-init + /zama-contract; disable-model-invocation)
└─ /zama-frontend (depends on /zama-init scaffold; bundles useDecrypted)
   ↓ unblocks: example dApp deploy

Phase 5 — Reference example dApp (Day 5-6)
├─ examples/confidential-token/ (run /zama-init token, polish, deploy Sepolia, deploy Vercel)
├─ Capture Sepolia address + Vercel URL
├─ examples/.../.gsd-snapshot.json
└─ Smoke-diff CI check against /zama-init output
   ↓ unblocks: README hero + demo video

Phase 6 — Distribution polish (Day 6-7)
├─ scripts/generate-generic.mjs + generic/*.md
├─ test/generic-sync.test.ts
├─ bin/install.mjs (npm fallback)
├─ test/install-cli.test.ts
├─ README (one-line install, demo GIF/video, skills table, troubleshooting)
├─ Hooks: post-write-check-deprecated.json + shared/scripts/check-deprecated.mjs (D3, P2)
├─ npm publish dry run
├─ Tag v0.1.0 → publish
└─ Submit
```

### Dependency Rationale Summary

- **Manifests (Phase 1) before bodies (Phase 3+):** invalid manifests block install testing.
- **Shared (Phase 2) before skill bodies (Phase 3+):** transclusion engine must exist before authors lean on it.
- **`/zama-init` (Phase 3) before other 4 skills (Phase 4):** other skills assume `/zama-init`'s output structure (hardhat config, dir layout, env vars). Building them first means rewriting when `/zama-init` settles.
- **All 5 skills (Phase 4) before example (Phase 5):** example is *the result of running them*. Backwards order = chicken-and-egg.
- **Example (Phase 5) before generic + README polish (Phase 6):** README leads with the live example URL; demo video shows the example. Generic/ is the last cosmetic step.
- **Hooks (Phase 6, P2):** D3 anti-deprecation hook is FEATURES.md P2 — ship it if time, defer if not. Hooks add install complexity (must be declared in plugin.json); validate end-to-end before adding.

---

## Anti-Patterns

### Anti-Pattern 1: Five separate plugins, one per skill

**What people do:** Treat each skill as its own marketplace entry to "let users pick what they need."
**Why it's wrong:** 5× install ceremony. Cross-skill `shared/` becomes impossible (each plugin is its own install root). FEATURES.md D10 explicitly chose plugin-level bundling.
**Do this instead:** One plugin (`zama-skills`), 5 skills inside it, shared/ alongside.

### Anti-Pattern 2: Hand-maintained `generic/*.md`

**What people do:** Author SKILL.md and generic markdown side by side, intending to keep them in sync manually.
**Why it's wrong:** Drift within 1-2 release cycles. Cursor users get stale instructions. Maintenance debt compounds with each new skill.
**Do this instead:** Generate generic/ from SKILL.md. CI fails on drift.

### Anti-Pattern 3: Cross-skill imports via `../other-skill/scripts/`

**What people do:** `/zama-deploy` reaches into `../zama-init/scripts/scaffold.mjs` to reuse a helper.
**Why it's wrong:** When the plugin is installed, Claude Code copies each skill folder; relative paths to siblings may or may not survive depending on install layout. STACK.md gotcha #9 calls this out.
**Do this instead:** Move shared helpers to `shared/scripts/` (which IS guaranteed to be copied because it's inside the plugin dir).

### Anti-Pattern 4: Pinning Sepolia contract addresses in skill source

**What people do:** Hardcode the Confidential Token Registry address in `/zama-deploy/scripts/register-token.mjs`.
**Why it's wrong:** STACK.md gotcha #7 — Zama updates these periodically. Stale addresses = silent deploy to dead contract.
**Do this instead:** `scripts/fetch-sepolia-addrs.mjs` queries `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` at runtime.

### Anti-Pattern 5: Examples as raw skill output committed verbatim

**What people do:** Run `/zama-init` once, commit the output as `examples/`, never touch again.
**Why it's wrong:** Example becomes the *test* of the skill. When the skill regresses, the example breaks. Two bugs (skill broken + example broken) blamed on the example. Confidence in both drops.
**Do this instead:** Examples are hand-curated *targets*; smoke-diff-check key files against fresh skill output but allow human polish on top. Documented in `.gsd-snapshot.json`.

### Anti-Pattern 6: SKILL.md > 500 lines

**What people do:** Inline every Solidity template, every prompt, every troubleshooting note in SKILL.md.
**Why it's wrong:** Anthropic guideline (HIGH confidence — official docs). Beyond 500 lines, the skill becomes hard for Claude to load efficiently and harder for humans to maintain.
**Do this instead:** Move templates to `assets/`, scripts to `scripts/`, shared prompts to `shared/`. Use progressive disclosure.

### Anti-Pattern 7: Forgetting `disable-model-invocation: true` on /zama-deploy

**What people do:** Default config across all skills.
**Why it's wrong:** Claude can autonomously deploy a contract to Sepolia because tests passed. STACK.md gotcha #5 + FEATURES.md T4 — this is THE textbook example for the flag.
**Do this instead:** Set `true` on `/zama-deploy`. Validate via `frontmatter.test.ts`.

---

## Integration Points

### External Services (runtime)

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| context7 MCP (`/zama-ai/fhevm`, etc.) | Skill body instructs Claude to call `mcp__context7__get-library-docs` before code gen | If MCP unavailable, fall back to `WebFetch(https://docs.zama.org/...)`. Document fallback in shared/context7-query.md |
| docs.zama.org (Sepolia addresses) | `WebFetch` from `scripts/fetch-sepolia-addrs.mjs` | Query at runtime, not build. Cache in process memory only. |
| GitHub (fhevm-react-template) | `git clone` invoked by `scripts/scaffold.mjs` | Pin to a commit SHA in `shared/pinned-versions.json` for reproducibility |
| Sepolia RPC | Hardhat config; user provides API key in `.env` | Skill scaffolds `.env.example` only; never commits keys |
| Confidential Token Registry (Sepolia) | `scripts/register-token.mjs` posts deployment | Address fetched live; tx output formatted with explorer link |
| Vercel (frontend deploy) | Manual via README instructions; not automated | Per FEATURES.md A13, skills do not auto-deploy |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| skill ↔ skill | None directly. Indirect via user repo state. | Enforced by no-cross-imports test |
| skill → shared | `<!-- include: ../../shared/foo.md -->` (build-time) and `${CLAUDE_SKILL_DIR}/../shared/scripts/foo.mjs` (runtime) | Note: `${CLAUDE_SKILL_DIR}` points to skill dir; `shared/` is at the plugin root, so `../shared/` from the skill dir |
| build script → repo | Mutates `generic/*.md` and `assets/**/package.json` only | Tests assert no other files touched |
| install CLI → user fs | Writes to `~/.claude/skills/` (personal) or `.claude/skills/` (project) | Prompts for scope; never writes without confirmation |

---

## Sources

**Authoritative (HIGH confidence):**
- [Anthropic — Plugins](https://code.claude.com/docs/en/plugins) — plugin.json schema, plugin discovery
- [Anthropic — Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) — marketplace.json schema, install commands
- [Anthropic — Skills](https://code.claude.com/docs/en/skills) — SKILL.md frontmatter, `${CLAUDE_SKILL_DIR}`, progressive disclosure
- [Anthropic — Agent skill best practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices) — 500-line limit, plan-validate-execute, one-skill-per-task
- [obra/superpowers](https://github.com/obra/superpowers) — reference structure: skills/, hooks/, scripts/, .claude-plugin/, multi-agent generic/ markdown pattern
- [obra/superpowers TDD skill](https://github.com/obra/superpowers/tree/main/skills/test-driven-development) — sample skill with SKILL.md + companion .md reference

**Cross-reference (already in this milestone's research):**
- `.planning/research/STACK.md` — version pins (drives `shared/pinned-versions.json`), gotchas #5, #7, #9 (drove anti-patterns)
- `.planning/research/FEATURES.md` — T4, T6, T13, D2, D5, D7, D10 directly shape the structural decisions above

**Confidence summary:**
- Repo layout (Layer A): HIGH — verified against published Claude Code plugin examples + obra/superpowers
- Shared/ pattern: HIGH — direct response to STACK.md gotcha #9
- Examples-vs-skills decision: MEDIUM-HIGH — both options defensible, picked the one that decouples skill regressions from example credibility
- Generic auto-gen: HIGH — drift risk in 5 skills × 2 platforms is empirically severe
- Build order: HIGH — load-bearing-feature reasoning matches FEATURES.md priority ordering

---
*Architecture research for: zama-skills (Claude Code skills plugin + npm package + reference dApp)*
*Researched: 2026-05-03*
