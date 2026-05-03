# Stack Research

**Domain:** AI agent skill package + Zama fhEVM dApp tooling (two-layer)
**Researched:** 2026-05-03
**Confidence:** HIGH (versions verified against npm registry + official Anthropic docs as of 2026-05-03)

> **Two-layer scope.** Layer A = the *skill package itself* (what we publish). Layer B = the *fhEVM stack* the skills generate code against. Both layers are pinned below with rationale.

---

## Layer A — Claude Code Skill Package (what we ship)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Claude Code Skills (SKILL.md) | Current spec, 2026-04+ | Primary distribution surface — every skill is a `SKILL.md` with YAML frontmatter | Native Claude Code format; auto-discovery via `~/.claude/skills/`, `.claude/skills/`, or plugin `<plugin>/skills/`. Custom commands have been *merged* into skills as of 2026 — `.claude/commands/foo.md` and `.claude/skills/foo/SKILL.md` both create `/foo`. Skills are the strict superset (HIGH confidence — official docs) |
| Claude Code Plugins (plugin.json + marketplace.json) | Current spec, 2026-04+ | Bundling format — one plugin = many skills + optional MCP/hooks/agents | Distribution unit. `marketplace.json` lives in `.claude-plugin/` at repo root; users add via `/plugin marketplace add <git-url>` then `/plugin install <name>@<marketplace>`. Reserved marketplace names exist (e.g. `agent-skills`, `claude-code-marketplace`) — pick a unique kebab-case name |
| Node.js | `>=20` | Runtime for the `npx zama-skills install` CLI | Matches engines field of fhevm-hardhat-template (`"node": ">=20"`); LTS, ESM-first |
| TypeScript | `^5.9.3` | CLI typing, manifest validation | Same version pinned in fhevm-hardhat-template — keeps versions aligned for users who import our types |
| npm | `>=7.0.0` | Package distribution | Workspaces support; matches Zama template engines field |

### SKILL.md Frontmatter — Pin These Fields

For every skill we ship (`/zama-init`, `/zama-contract`, `/zama-test`, `/zama-deploy`, `/zama-frontend`):

```yaml
---
name: zama-contract                        # kebab-case, ≤64 chars, must match dir name
description: <≤1536 chars combined w/ when_to_use; lead with use case>
when_to_use: <trigger phrases for auto-invoke>
argument-hint: "[contract-type]"           # shown in autocomplete
allowed-tools: Read Write Edit Bash(npx hardhat *) Bash(npm *) WebFetch
disable-model-invocation: false            # true ONLY for /zama-deploy (side effects)
context: fork                              # ONLY for heavy research skills (`/zama-init`)
agent: Explore                             # paired with context: fork
---
```

**Rationale (HIGH confidence — official Anthropic docs):**
- `description` is the matching key for auto-invoke; combined `description` + `when_to_use` cap is **1,536 chars**. Lead with key use case.
- `disable-model-invocation: true` for `/zama-deploy` is critical — we do *not* want Claude auto-deploying a contract because it "looks ready."
- `allowed-tools` whitelist avoids per-call permission prompts during long workflows (huge UX win).
- `context: fork` runs in isolated subagent — use for `/zama-init` (template scaffolding can be noisy).
- `${CLAUDE_SKILL_DIR}` substitution is the way to reference bundled scripts/templates; works regardless of install scope (personal/project/plugin).

### Distribution Layout

```
zama-skills/                               # GitHub repo + npm package
├── .claude-plugin/
│   └── marketplace.json                   # marketplace catalog
├── plugins/
│   └── zama-skills/
│       ├── .claude-plugin/
│       │   └── plugin.json                # name, version, description
│       ├── skills/
│       │   ├── zama-init/SKILL.md
│       │   ├── zama-contract/SKILL.md
│       │   ├── zama-test/SKILL.md
│       │   ├── zama-deploy/SKILL.md
│       │   └── zama-frontend/SKILL.md
│       └── templates/                     # referenced via ${CLAUDE_SKILL_DIR}
├── generic/                               # markdown rehberler for non-Claude agents
│   ├── cursor.md
│   ├── codex.md
│   └── gemini.md
├── bin/
│   └── install.js                         # `npx zama-skills install` entrypoint
├── package.json                           # npm publish target
└── README.md
```

### Supporting Libraries (Layer A)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `commander` | `^12.x` | CLI argument parsing for `npx zama-skills install` | Standard Node CLI lib; minimal API surface |
| `prompts` | `^2.x` | Interactive prompts (scope: personal vs project install) | Lightweight; no React dep |
| `picocolors` | `^1.1.1` | Terminal coloring for install output | Same version Zama uses; tiny |
| `fs-extra` | `^11.x` | Recursive copy of skill files into `~/.claude/skills/` | Avoids hand-rolling `cp -r` |
| `zod` | `^3.x` | Validate `marketplace.json` / `plugin.json` shape before publish | Catches schema errors at CI time |

**Dev only:**

| Library | Version | Purpose |
|---------|---------|---------|
| `vitest` | `^2.x` | Unit tests for the install CLI |
| `tsx` | `^4.x` | Run TS directly without build step |
| `@types/node` | `^20.19.30` | Match Zama template node types version |

---

## Layer B — fhEVM dApp Stack (what the skills generate)

> **Source of truth.** All versions below verified via `npm view <pkg> version` on 2026-05-03 *and* cross-checked against the live `package.json` of `zama-ai/fhevm-hardhat-template@main`. These are the exact versions Zama themselves are shipping.

### Smart Contract Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@fhevm/solidity` | `^0.11.1` (published 2026-02-19) | Solidity library: `FHE.sol`, `euint*`, `ebool`, `eaddress`, ACL primitives | Official Zama Solidity library. Replaces deprecated `fhevm` package. Used by both fhevm-hardhat-template and OZ Confidential Contracts (peer dep `@fhevm/solidity: 0.11.1`) — pin to `^0.11.1` for ecosystem alignment |
| `@openzeppelin/confidential-contracts` | `^0.4.0` (published 2026-03-30) | ERC-7984 confidential token + governance + vesting primitives | Standardized confidential token (`ERC7984`), `ERC7984ERC20Wrapper`, `ConfidentialFungibleToken`, `VotesConfidential`, `FHESafeMath`. Peer-deps `@fhevm/solidity@0.11.1` and `@openzeppelin/contracts@^5.6.1` — versions align cleanly |
| `@openzeppelin/contracts` | `^5.6.1` | Standard OZ contracts (Ownable, AccessControl, etc.) | Required peer dep of confidential-contracts; latest 5.x line |
| `@openzeppelin/contracts-upgradeable` | `^5.6.1` | Upgradeable variants | Optional but commonly paired |
| `encrypted-types` | `^0.0.4` | TypeScript types for encrypted handles (shared by SDK + plugin) | Required peer dep; small utility package |
| Solidity compiler | `0.8.27` (template default) — supports `^0.8.24` | EVM compilation | Template uses `0.8.27`; OZ confidential supports `^0.8.24+` |

### Hardhat / Testing Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@fhevm/hardhat-plugin` | `^0.4.2` (published 2026-02-19) | Hardhat integration: encrypted input mocking, decrypt assertions, local FHE node | Official plugin. Pulls in `@fhevm/host-contracts@0.10.0` + `@fhevm/mock-utils@0.4.2` automatically. **Pin exactly `0.4.2` for `@fhevm/mock-utils` and `@zama-fhe/relayer-sdk@0.4.1`** — these are listed as exact-version peer deps |
| `@fhevm/mock-utils` | `^0.4.2` | Mock encrypt/decrypt for unit tests | Exact-version peer of hardhat-plugin |
| `hardhat` | `^2.28.4` (template) — `^2.0.0` (plugin floor) | Dev framework | Hardhat 2.x line. Note: `hardhat@3.x` is now released (`3.4.3` latest) but **fhevm plugin still targets v2** as of 2026-05 — do NOT use Hardhat 3 yet |
| `@nomicfoundation/hardhat-ethers` | `^3.1.3` | Ethers integration for Hardhat | Required peer of fhevm plugin |
| `@nomicfoundation/hardhat-chai-matchers` | `^2.1.0` | Chai assertions for contracts | Standard Hardhat testing |
| `@nomicfoundation/hardhat-network-helpers` | `^1.1.2` | Time-travel, snapshots | Test helpers |
| `@nomicfoundation/hardhat-verify` | `^2.1.3` | Etherscan verification post-deploy | Sepolia verification |
| `hardhat-deploy` | `^0.11.45` | Deploy script orchestration | Template uses this for repeatable deploys |
| `hardhat-gas-reporter` | `^2.3.0` | Gas profiling | FHE ops are expensive — gas reports matter |
| `solidity-coverage` | `^0.8.17` | Coverage | Standard |
| `@typechain/ethers-v6` | `^0.5.1` + `@typechain/hardhat@^9.1.0` + `typechain@^8.3.2` | Generated TS types for contracts | Ethers v6 codegen |
| `ethers` | `^6.16.0` | Web3 lib | v6 (NOT v5); fhevm plugin pinned to v6 |

### Frontend / Client SDK Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@zama-fhe/relayer-sdk` | `^0.4.2` (published 2026-04-10) | **Frontend SDK** — encrypt inputs, request decryption, build relayed transactions | Official replacement for deprecated `fhevmjs`. **`fhevmjs` is officially deprecated** (last `0.6.2`, deprecated 2025-07-10 with message: *"use @zama-fhe/relayer-sdk instead"*). The hardhat-plugin pins `@zama-fhe/relayer-sdk@0.4.1` exactly as a peer; use `^0.4.2` in the frontend (newer patch, compatible) |
| React | `^18.x` (template) | UI framework | fhevm-react-template uses React 18. React 19 untested with relayer-sdk |
| Next.js | `15.x` (per react-template fork) | App framework | Some forks use Next 15 + Foundry; official template is plain Vite+React. Recommend Vite for the bounty example (less surface area in 7 days) |
| `viem` | latest (optional) | Alternative to ethers | The react-template uses `viem` in some packages; ethers v6 is what hardhat-plugin and Zama docs use. **Pick ethers v6 for consistency**, mention viem in skill as alternative |

### Network / Infrastructure

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Sepolia testnet | n/a | Only supported testnet for v1 | Mainnet out of scope (per PROJECT.md). Zama operates ACL/KMS/Coprocessor contracts on Sepolia |
| Sepolia RPC | Alchemy / Infura / public | RPC endpoint | Use `INFURA_API_KEY` env pattern from template |
| Zama Relayer (Sepolia) | `https://relayer.testnet.zama.cloud` (verify per skill via context7 query) | Off-chain decryption oracle relayer | Addresses + URLs published at https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia — **the skill should fetch this live**, not pin in code, because Zama updates contract addresses periodically |
| Confidential Token Registry (Sepolia) | Live address — query via context7 / docs | Registry where confidential tokens self-register | Same: fetch live, do not pin in skill source |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `solhint` `^6.0.3` + `prettier-plugin-solidity` `^2.2.1` | Solidity lint/format | Match template config |
| `eslint` `^9.39.2` + `typescript-eslint` `^8.54.0` | TS lint | Flat config (`eslint.config.js`) |
| `prettier` `^3.8.1` | Format | Standard |
| `dotenv` `^16.5.0` | Env var loading | Used by hardhat-plugin internally |
| `cross-env` `^7.0.3` | Cross-platform env vars | For npm scripts |
| `mocha` `^11.7.5` + `chai` `^4.5.0` + `chai-as-promised` `^8.0.2` | Test runner / assertions | Hardhat default |
| `rimraf` `^6.1.2` | Cross-platform clean | Standard |

---

## Installation

### For users of `zama-skills` (Layer A)

```bash
# One-line install via marketplace
/plugin marketplace add github.com/<owner>/zama-skills
/plugin install zama-skills@zama-skills

# OR via npm CLI fallback
npx zama-skills install            # interactive: choose personal vs project scope
```

### Generated by `/zama-init` (Layer B)

```bash
# Smart contracts + tests
npm install --save \
  @fhevm/solidity@^0.11.1 \
  @openzeppelin/confidential-contracts@^0.4.0 \
  @openzeppelin/contracts@^5.6.1 \
  encrypted-types@^0.0.4

npm install --save-dev \
  @fhevm/hardhat-plugin@^0.4.2 \
  @fhevm/mock-utils@^0.4.2 \
  hardhat@^2.28.4 \
  @nomicfoundation/hardhat-ethers@^3.1.3 \
  @nomicfoundation/hardhat-chai-matchers@^2.1.0 \
  @nomicfoundation/hardhat-network-helpers@^1.1.2 \
  @nomicfoundation/hardhat-verify@^2.1.3 \
  hardhat-deploy@^0.11.45 \
  hardhat-gas-reporter@^2.3.0 \
  solidity-coverage@^0.8.17 \
  @typechain/ethers-v6@^0.5.1 \
  @typechain/hardhat@^9.1.0 \
  typechain@^8.3.2 \
  ethers@^6.16.0 \
  typescript@^5.9.3 \
  @types/node@^20.19.30 \
  dotenv@^16.5.0

# Frontend (React + Vite)
npm install --save \
  @zama-fhe/relayer-sdk@^0.4.2 \
  ethers@^6.16.0 \
  react@^18 react-dom@^18
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@zama-fhe/relayer-sdk@^0.4.2` | `fhevmjs@0.6.2` | **Never.** Officially deprecated 2025-07-10. Skills MUST refuse to generate code that imports `fhevmjs` |
| `@fhevm/solidity@^0.11.1` | `fhevm` (root package) | **Never.** `fhevm@0.6.2` deprecated 2025-07-10 — *"use @fhevm/solidity instead"* |
| `hardhat@^2.28.4` | `hardhat@^3.4.3` | Not yet — fhevm plugin peer-deps `hardhat@^2.0.0`. Revisit Q3 2026 |
| `ethers@^6.16.0` | `viem` | If user explicitly insists; relayer-sdk works with both, but ethers has more docs/examples in Zama ecosystem |
| Plain SKILL.md plugin | MCP server | MCP duplicates work — context7 already exposes `/zama-ai/fhevm` (1772 snippets), `/zama-ai/fhevm-hardhat-template`, `/websites/openzeppelin_confidential-contracts`. Per PROJECT.md decision, do NOT build a custom MCP |
| Vite + React (template) | Next.js 15 | Next.js if user has SSR/SEO needs. Vite is lighter for the bounty demo |
| Sepolia | fhEVM Devnet (legacy) | **Never** — devnet was deprecated when Zama Protocol shipped Sepolia testnet support |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `fhevmjs` (any version) | Deprecated 2025-07-10 — official message: *"use @zama-fhe/relayer-sdk instead"* | `@zama-fhe/relayer-sdk@^0.4.2` |
| `fhevm` (root package, any version) | Deprecated 2025-07-10 — official message: *"use @fhevm/solidity instead"* | `@fhevm/solidity@^0.11.1` |
| `hardhat@3.x` | fhevm-plugin peer-dep is `hardhat@^2.0.0`; v3 untested + breaking config changes | `hardhat@^2.28.4` |
| `ethers@^5` | fhevm-plugin pins ethers v6; v5 will mismatch typechain output | `ethers@^6.16.0` |
| Pinning Sepolia contract addresses inside skill source | Zama updates ACL/KMS/Coprocessor addresses periodically | Skills should query `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` (or context7) at runtime |
| Custom MCP server for Zama docs | Reinvents `/zama-ai/fhevm` (HIGH-reputation context7 source, 1772 snippets) | Use context7 directly via `mcp__context7__*` calls inside SKILL.md instructions |
| Mainnet deploy automation in v1 | Out of scope per PROJECT.md; risk + audit gap | Sepolia only |
| Cursor `.cursorrules` native format | Out of scope per PROJECT.md | Generic markdown rehber in `generic/cursor.md` |

---

## Stack Patterns by Variant

**If user picks "confidential token" use case in `/zama-init`:**
- Scaffold `ERC7984` from `@openzeppelin/confidential-contracts` with `ERC7984ERC20Wrapper`
- Include `FHESafeMath` for safe arithmetic on `euint*`
- Generate Confidential Token Registry registration script

**If user picks "voting" use case:**
- Use `VotesConfidential` from `@openzeppelin/confidential-contracts`
- Pair with `CheckpointsConfidential` for snapshot history

**If user picks "auction / sealed-bid" use case:**
- No OZ primitive — generate from scratch using `euint64` for bids + `FHE.le` / `FHE.select` for winner selection
- Reference Zama's auction example via context7 `/zama-ai/fhevm` topic="auction"

**If user picks "custom":**
- `/zama-contract` walks them through `euint`/`ebool` + ACL grant patterns
- Skill must query `/zama-ai/fhevm` for current ACL pattern (it changed in `@fhevm/solidity@0.11.x`)

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@fhevm/hardhat-plugin@0.4.2` | `@fhevm/solidity@^0.11.1`, `@fhevm/mock-utils@0.4.2` (exact), `@zama-fhe/relayer-sdk@0.4.1` (exact peer), `ethers@^6.16.0`, `hardhat@^2.0.0`, `encrypted-types@^0.0.4` | Peer deps are tight — bumping any of these without bumping plugin will fail install |
| `@openzeppelin/confidential-contracts@0.4.0` | `@fhevm/solidity@0.11.1` (exact peer), `@openzeppelin/contracts@^5.6.1`, `@openzeppelin/contracts-upgradeable@^5.6.1` | OZ pins fhevm/solidity to *exact* `0.11.1` — keep both versions in lockstep |
| `@zama-fhe/relayer-sdk@0.4.2` | Hardhat-plugin peer is `0.4.1` — `^0.4.2` is forward-compatible for *frontend* use, but devDep should match plugin's peer | Use `0.4.1` in `devDependencies` (matches plugin peer), `^0.4.2` in frontend `dependencies` |
| Solidity `0.8.27` | All of the above | OZ confidential supports `^0.8.24+`; pick `0.8.27` to match template |
| Node `>=20` | All | Template engines field |

---

## Gotchas Where Docs Lie / Changed Recently

1. **`fhevmjs` results dominate Google search** — most blog posts (2024-early 2025) reference the deprecated package. Skills must explicitly NOT generate `import { ... } from 'fhevmjs'`. Lint rule recommended.
2. **`fhevm` (root pkg) vs `@fhevm/solidity`** — same deprecation story. Anything telling you to `npm install fhevm` is stale.
3. **Hardhat 3 is GA** but fhevm tooling still targets Hardhat 2 — do not assume "latest is best."
4. **Custom commands merged into skills** (Anthropic docs, 2026) — `.claude/commands/` still works but skills are the strict superset. Ship as skills, not commands.
5. **`disable-model-invocation` is critical for `/zama-deploy`** — without it Claude can autonomously deploy a contract because the test suite passed. Always set `true` for skills with on-chain side effects.
6. **`description` + `when_to_use` cap is 1,536 chars** — beyond that, autocomplete/auto-invoke loses keywords. Lead with key use case.
7. **Zama Sepolia contract addresses change periodically** — pin URL not addresses. Skills should `WebFetch`/`mcp__context7__*` at runtime.
8. **Marketplace name reservations** — `agent-skills`, `claude-code-marketplace`, `claude-code-plugins`, `claude-plugins-official`, `anthropic-marketplace`, `anthropic-plugins`, `knowledge-work-plugins`, `life-sciences` are all reserved. Don't pick a name that "looks official."
9. **Plugin install copies files to cache** — relative paths like `../shared-utils` break post-install. Use `${CLAUDE_SKILL_DIR}` substitution for any bundled scripts.
10. **`@zama-fhe/relayer-sdk@0.4.1` (peer of plugin) vs `0.4.2` (latest)** — keep these correctly scoped (devDep at 0.4.1, prod dep at 0.4.2) or npm will complain.

---

## Sources

**Authoritative (HIGH confidence):**
- npm registry via `npm view <pkg> version time.modified peerDependencies` — verified 2026-05-03 for `@fhevm/solidity@0.11.1`, `@fhevm/hardhat-plugin@0.4.2`, `@fhevm/mock-utils@0.4.2`, `@zama-fhe/relayer-sdk@0.4.2`, `@openzeppelin/confidential-contracts@0.4.0`, `@openzeppelin/contracts@5.6.1`, `encrypted-types@0.0.4`, `@fhevm/host-contracts@0.10.0`, `hardhat@2.28.4` (template-pinned), `ethers@6.16.0`
- Deprecation notices for `fhevmjs@0.6.2` and `fhevm@0.6.2` — verified via `npm view ... deprecated`
- `https://raw.githubusercontent.com/zama-ai/fhevm-hardhat-template/main/package.json` — verified entire dependency tree on 2026-05-03
- `https://code.claude.com/docs/en/skills` — official Anthropic SKILL.md spec, frontmatter reference, lifecycle, substitutions
- `https://code.claude.com/docs/en/plugin-marketplaces` — official marketplace.json schema, plugin.json schema, `/plugin marketplace add`, reserved names list

**Context7 sources (referenced live by skills, not pinned at build):**
- `/zama-ai/fhevm` — 1772 snippets, HIGH reputation
- `/zama-ai/fhevm-hardhat-template` — 43 snippets, HIGH reputation
- `/websites/openzeppelin_confidential-contracts` — 354 snippets, HIGH reputation

**Reference documentation (HIGH confidence — official Zama):**
- https://docs.zama.org/protocol/solidity-guides/getting-started/quick-start-tutorial
- https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia (live address registry — query at runtime, do not pin)
- https://github.com/zama-ai/fhevm-react-template
- https://github.com/OpenZeppelin/openzeppelin-confidential-contracts

**Confidence summary:**
- Layer A (skill packaging): HIGH — Anthropic docs are current and unambiguous
- Layer B (fhEVM versions): HIGH — pinned via direct npm registry queries on 2026-05-03 + cross-checked against template `package.json`
- Sepolia contract addresses: NOT PINNED HERE — fetch live (intentional)
- React-template deeper internals (Vite vs Next, viem vs ethers per package): MEDIUM — template is a monorepo with multiple packages; recommend verifying chosen subpath at `/zama-init` time

---
*Stack research for: zama-skills (Claude Code skill package + fhEVM dApp toolchain)*
*Researched: 2026-05-03*
