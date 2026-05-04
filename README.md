# zama-skills

> Zama Protocol skill pack for Claude Code — from an empty directory to a working confidential dApp in 30 minutes.

[![CI](https://github.com/kocaemre/zama-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/kocaemre/zama-skills/actions) [![npm](https://img.shields.io/npm/v/zama-skills?logo=npm&label=npm)](https://www.npmjs.com/package/zama-skills) [![Sepolia Verified](https://img.shields.io/badge/Sepolia-Verified-brightgreen?logo=ethereum)](https://sepolia.etherscan.io/address/0x04Bd105DE7a5D3297c3747cef90ac8b760136896#code) [![Vercel Live](https://img.shields.io/badge/Vercel-Live-black?logo=vercel)](https://zama-skills.vercel.app) <!-- @sync:vercel-url -->

**Built for:** [Zama Developer Program — Mainnet Season 2 / Bounty Track](https://docs.zama.org/protocol/community/programs).

**Differentiator:** Every generated line is verified live against official Zama documentation via [context7](https://github.com/upstash/context7) MCP — `/zama-ai/fhevm` (1,772 snippets), `/zama-ai/fhevm-hardhat-template`, `/websites/openzeppelin_confidential-contracts`. **Zero hallucinated APIs.**

## Prerequisites

| Tool | Why | Install |
|------|-----|---------|
| Node.js >= 20 | Runtime for skill scripts | [nvm](https://github.com/nvm-sh/nvm) → `nvm install 20` |
| pnpm 10+ | Package manager (skill-generated projects use it) | `npm install -g pnpm@10` |
| `context7` MCP | **REQUIRED** — live Zama / OZ Confidential docs (anti-hallucination) | `claude mcp add context7 -- npx -y @upstash/context7-mcp` |
| `magic` MCP (21st.dev) | RECOMMENDED — better UI scaffolds for `/zama-frontend` and `/zama-design` | `claude mcp add magic -- npx -y @21st-dev/magic` |

After install, verify with **`/zama-doctor`** — it checks every requirement and prints fix commands for whatever is missing.

## Install

```bash
# In Claude Code:
/plugin marketplace add github.com/kocaemre/zama-skills
/plugin install zama-skills@zama-skills
/zama-doctor                     # confirm Node/pnpm/context7/magic are ready
```

Fallback for non-Claude-Code agents or scripted setup:

```bash
npx zama-skills install
```

## Demo

<!-- @sync:demo-video -->
[**▶ Watch the 2-minute walkthrough**](https://youtu.be/<VIDEO_ID>)
&nbsp;&nbsp;·&nbsp;&nbsp;
[Live dApp](https://zama-skills.vercel.app)
&nbsp;&nbsp;·&nbsp;&nbsp;
[Verified contract](https://sepolia.etherscan.io/address/0x04Bd105DE7a5D3297c3747cef90ac8b760136896#code)

<!-- @sync:demo-gif -->
![demo placeholder — see docs/demo-gif-capture.md](examples/confidential-token/docs/demo.gif)

Voice-over walkthrough: `marketplace add` → `/zama-design` → `/zama-init` → `/zama-contract` → `/zama-deploy` (live Sepolia) → MetaMask decrypt on the live dApp. See [`docs/demo-video-script.md`](docs/demo-video-script.md) for the recording script and [`docs/demo-gif-capture.md`](docs/demo-gif-capture.md) for the silent GIF.

## Quick Start — pick your path

After installing the plugin, jump straight to the path that matches your goal. Each path is a chain of skills; Claude Code picks the next one automatically from the closing summary, but you can also type the slash commands yourself.

### Path 0 — One command, the whole thing (~30 min, recommended for first-timers)

```
/zama-autonomous
```

Runs the full pipeline (design → init → contract → test → audit → deploy → frontend) in sequence. Pauses only at safety gates: design review, audit findings, the manual deploy confirmation, and final smoke. Resumable — if you stop or hit an error, re-run with `--resume` and it picks up where it left off.

State lives at `.planning/v1-autonomous/state.json` (no secrets, just step progress). Run `/zama-doctor` first if you're not sure your environment is ready.

### Path 1 — Manual chain (full pipeline, ~30 min)

Same outcome as Path 0, but you trigger each skill yourself:

```
/zama-design   →   "describe your idea"
/zama-init     →   scaffold the monorepo
/zama-contract →   write the confidential contract
/zama-test     →   mock + Sepolia tests
/zama-audit    →   FHE-aware code review (must pass)
/zama-deploy   →   Sepolia deploy + Etherscan verify
/zama-frontend →   wire the UI
```

Best for: hackathon submissions, MVPs, learning the stack end-to-end. Each skill's closing summary tells you the next one — Claude Code auto-suggests it.

### Path 2 — Just the contract (~5 min)

You already have a project; you only need a confidential ERC-7984 / Votes / custom contract.

```
/zama-contract
# pick: name, base (erc7984 / votes / custom), state schema, decryption path
```

Output drops at `packages/contracts/contracts/<Name>.sol` with auto-injected ACL grants and a refusal to emit any cleartext-leak pattern. Recommended follow-up: `/zama-test` for the test scaffolding, `/zama-audit` to confirm the diff is clean.

### Path 3 — Audit / harden an existing contract (~2 min)

You inherited a confidential contract or wrote one by hand. Run the FHE-aware review:

```
/zama-audit              # scans current directory
/zama-audit ./contracts  # scoped to a path
```

Reports ACL gaps, cleartext leaks, HCU explosions (>12 FHE ops/fn), deprecated imports. Exits 0 (clean), 1 (warnings), 2 (critical) so you can wire it into CI.

### Path 4 — Debug a runtime error (~1 min)

You got an error from hardhat, vitest, the relayer, or the live dApp. Paste it:

```
/zama-debug
# paste the stack trace / revert message when prompted
```

Matches against a 10+ pattern catalog (ACL revert, `initSDK undefined`, deprecated imports, HCU exceeded, SSR `indexedDB`, etherscan v1, relayer timeout, etc.) and prints the root cause + the exact fix command.

### Path 5 — Design only (no code), then hand off

You want a planning artifact you can share with collaborators or feed into the chain later.

```
/zama-design
```

Produces `DESIGN.md` (contract architecture + ACL strategy per actor + decryption path per data type) and `UI-WIREFRAME.md` (component tree + 4-state UX flows). Both files reference live Zama docs via context7 — no hallucinated APIs. Pick this path if you want to validate the architecture before committing to scaffolding.

---

## What you get — 10 skills

| Slash command | When it runs | What it does |
|---------------|--------------|--------------|
| `/zama-skills:init` | "init zama project", "new fhevm dapp", "scaffold confidential token", empty dir | Forks `fhevm-react-template`, asks for use-case (token / voting / auction / custom), wires pinned versions, generates `.env.example` + MetaMask Sepolia deep-link |
| `/zama-skills:contract` | "write fhevm contract", "confidential token", "euint", "FHE.allow"; editing `.sol` in fhevm project | Authors confidential contracts with `euint`/`ebool`/`eaddress`, ACL `FHE.allowThis`, OZ Confidential Contracts (ERC-7984); rejects `require(decrypt(...))` cleartext leaks |
| `/zama-skills:test` | "test fhevm", "mock encrypted input", "decrypt assertion", "sepolia integration test" | Generates mock + Sepolia integration tests with `@fhevm/hardhat-plugin`, decrypt assertions, HCU-budget warnings |
| `/zama-skills:deploy` | manual only — explicit `/zama-skills:deploy` invocation; never auto-triggers | Deploys to Sepolia + verifies on Etherscan + auto-registers Confidential Token Registry; pulls live addresses, never pins |
| `/zama-skills:frontend` | "fhevm frontend", "relayer sdk", "useDecrypted"; editing `src/` or `app/` in fhevm project | Wires `@zama-fhe/relayer-sdk`, `useDecrypted` hook with relayer UX states, ethers v6 + typechain, encrypted-input components |
| `/zama-skills:design` | "I have an idea", "design my dApp", "plan a confidential auction", before any scaffolding | Reads your use-case, queries context7 against `/zama-ai/fhevm` + OZ Confidential, produces `DESIGN.md` (contract architecture + ACL strategy) and `UI-WIREFRAME.md` (component tree + 4-state UX flows) |
| `/zama-skills:audit` | "audit this contract", "check FHE bugs", post-`/zama-contract` review | Scans Solidity + TS for ACL gaps, cleartext leaks (require/event), HCU explosions (>12 FHE ops/fn), deprecated imports — exits 0/1/2 for CI |
| `/zama-skills:debug` | "I got an FHE error", paste a stack trace | Matches your error against a 10+ pattern catalog (ACL revert, `initSDK undefined`, deprecated imports, HCU exceeded, SSR `indexedDB`, etc.) — returns root cause + fix command |
| `/zama-skills:doctor` | "check zama setup", "what's missing", first-time install verification | Read-only diagnostic — checks Node, pnpm, git, `context7` MCP (required), `magic` MCP (recommended), Sepolia RPC reachability, plugin install status. Prints fix commands for whatever is missing. |
| `/zama-skills:autonomous` | "do everything", "full pipeline", "build me a confidential dApp", first-time users | One-command orchestrator — runs design → init → contract → test → audit → deploy → frontend in sequence. Pauses at safety gates (design review, audit findings, manual deploy). Resumable via `--resume`. State at `.planning/v1-autonomous/state.json`. |

`/zama-skills:deploy` has `disable-model-invocation: true` — Claude **will not** auto-deploy on its own. You must invoke it explicitly.

## Try it live

See [`examples/confidential-token/`](examples/confidential-token/) — a confidential ERC-7984 token (cDEMO) deployed to Sepolia at [`0x04Bd105DE7a5D3297c3747cef90ac8b760136896`](https://sepolia.etherscan.io/address/0x04Bd105DE7a5D3297c3747cef90ac8b760136896#code) and live on Vercel. Built end-to-end by running this plugin's skills against an empty directory — every contract, test, deploy script, and React component is reproducible from the recorded skill commit SHAs in [`.gsd-snapshot.json`](examples/confidential-token/.gsd-snapshot.json).

## Why this exists

Building a confidential dApp on Zama Protocol requires juggling: pinned `@fhevm/solidity` + `@openzeppelin/confidential-contracts` versions, ACL discipline (`FHE.allowThis` after every state write), HCU budget awareness (20M/tx, 5M depth), three different decryption paths (public / user / oracle), the Confidential Token Registry, and the relayer SDK on the frontend. Get any of it wrong — say, ship code that imports the deprecated `fhevmjs` package or forgets a single `FHE.allow` call — and your dApp silently fails on Sepolia.

`zama-skills` codifies the official patterns. Every skill, before generating code, queries context7 for the canonical Zama doc snippet that covers the user's request. **No "vibes-based FHE."**

## Compatibility

- **Network:** Sepolia testnet only (mainnet support deferred to v2 — needs auditing rigor).
- **Node.js:** `>=20`.
- **Solidity:** `^0.8.24+` (template default `0.8.27`).
- **Hardhat:** `^2.x` (Hardhat 3 is not supported by `@fhevm/hardhat-plugin` yet).
- **Ethers:** v6 only (v5 will mismatch typechain output).
- **Refuses to emit:** `fhevmjs` (deprecated 2025-07-10 → use `@zama-fhe/relayer-sdk`), root `fhevm` package (deprecated → use `@fhevm/solidity`), `ethers@5`, Hardhat 3.

## How it works

```
.claude-plugin/marketplace.json      ← catalog
plugins/zama-skills/
├── .claude-plugin/plugin.json        ← manifest
└── skills/
    ├── init/SKILL.md                 ← /zama-skills:init   (auto-invoke, context: fork)
    ├── contract/SKILL.md             ← /zama-skills:contract
    ├── test/SKILL.md                 ← /zama-skills:test
    ├── deploy/SKILL.md               ← /zama-skills:deploy (manual only)
    ├── frontend/SKILL.md             ← /zama-skills:frontend
    ├── design/SKILL.md               ← /zama-skills:design  (plan/blueprint, v1.1)
    ├── audit/SKILL.md                ← /zama-skills:audit   (FHE-aware code review, v1.1)
    └── debug/SKILL.md                ← /zama-skills:debug   (error → fix matcher, v1.1)
```

The plugin is a single Claude Code marketplace at the repo root. Skill folder names drop the `zama-` prefix (the plugin namespace already supplies it) so commands read `/zama-skills:init` not `/zama-skills:zama-init`.

## CI / quality gates

- `npm run validate` — zod schema check for `marketplace.json` + `plugin.json` + all 5 SKILL.md frontmatters (rejects: bad kebab-case, reserved marketplace names, `..` in source paths, missing `disable-model-invocation` on deploy, missing `context: fork` on init, missing `allowed-tools` on any skill, combined description+when_to_use over 1,536 chars).
- `npx tsc --noEmit` — strict TypeScript on the CLI.
- `npm test` — vitest.
- GitHub Actions runs all of the above on push and every PR.

## Roadmap

| Phase | Status | Goal |
|-------|--------|------|
| 1 — Plugin Foundation + CI | Done | Marketplace + manifests + 5 SKILL.md skeletons + CI gating |
| 2 — Shared Infrastructure | Done | Pinned versions, deprecated-imports list, transclusion build engine |
| 3 — `/zama-skills:init` | Done | Headline scaffolding skill — full flow |
| 4 — Remaining 4 skills | Done | contract, test, deploy, frontend |
| 5 — Reference example dApp | Done | Confidential token deployed on Sepolia + live frontend |
| 6 — Distribution / submission | Active | npm publish, README polish, demo video, submit |

## Links

- **Repository:** [github.com/kocaemre/zama-skills](https://github.com/kocaemre/zama-skills)
- **npm package:** [npmjs.com/package/zama-skills](https://www.npmjs.com/package/zama-skills)
- **Example dApp:** [`examples/confidential-token/`](examples/confidential-token/)
- **Live demo:** [zama-skills.vercel.app](https://zama-skills.vercel.app)
- **Roadmap:** [`.planning/ROADMAP.md`](.planning/ROADMAP.md)
- **Contributing:** [`CONTRIBUTING.md`](CONTRIBUTING.md)
- **License:** [`LICENSE`](LICENSE)
- **Third-party licenses:** [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md)

## License

[MIT](./LICENSE) © 2026 Emre Koca

## Acknowledgements

- [Zama](https://www.zama.ai) — fhEVM, FHE Solidity library, hardhat plugin, relayer SDK
- [OpenZeppelin](https://www.openzeppelin.com) — Confidential Contracts (ERC-7984)
- [Anthropic](https://www.anthropic.com) — Claude Code skills + plugins format
- [context7](https://github.com/upstash/context7) — live docs MCP that powers anti-hallucination
