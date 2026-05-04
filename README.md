# zama-skills

> Zama Protocol skill pack for Claude Code — from an empty directory to a working confidential dApp in 30 minutes.

[![CI](https://github.com/kocaemre/zama-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/kocaemre/zama-skills/actions) [![npm](https://img.shields.io/npm/v/zama-skills?logo=npm&label=npm)](https://www.npmjs.com/package/zama-skills) [![Sepolia Verified](https://img.shields.io/badge/Sepolia-Verified-brightgreen?logo=ethereum)](https://sepolia.etherscan.io/address/0x04Bd105DE7a5D3297c3747cef90ac8b760136896#code) [![Vercel Live](https://img.shields.io/badge/Vercel-Live-black?logo=vercel)](https://zama-skills.vercel.app) <!-- @sync:vercel-url -->

**Built for:** [Zama Developer Program — Mainnet Season 2 / Bounty Track](https://zama.org/developer-hub).

**Differentiator:** Every code-generating skill (`/zama-contract`, `/zama-test`, `/zama-frontend`, `/zama-audit`, `/zama-debug`) queries [context7](https://github.com/upstash/context7) MCP for live Zama documentation before emitting code — `/zama-ai/fhevm` (1,772 snippets), `/zama-ai/fhevm-hardhat-template`, `/websites/openzeppelin_confidential-contracts`. APIs are checked against current docs, not the model's training cut-off, so deprecated packages and renamed symbols don't slip through.

## Prerequisites

| Tool | Why | Install |
|------|-----|---------|
| Node.js >= 20 | Runtime for skill scripts | [nvm](https://github.com/nvm-sh/nvm) → `nvm install 20` |
| pnpm 10+ | Package manager (skill-generated projects use it) | `npm install -g pnpm@10` |
| `context7` MCP | **REQUIRED** — live Zama / OZ Confidential docs (anti-hallucination) | `claude mcp add context7 -- npx -y @upstash/context7-mcp` |
| `magic` MCP (21st.dev) | RECOMMENDED — better UI scaffolds for `/zama-frontend` and `/zama-design` | `claude mcp add magic -- npx -y @21st-dev/magic` |

After install, verify with **`/zama-doctor`** — it checks every requirement and prints fix commands for whatever is missing.

## Install — pick your AI tool

> **Best experience: Claude Code.** This pack was designed around Claude Code's slash commands, skill auto-routing, and inter-skill chaining (`/zama-design` → `/zama-init` → `/zama-contract` → `/zama-test` → `/zama-audit` → `/zama-deploy`). The other tools get the same underlying skill content as portable markdown rules — useful, but you orchestrate the chain yourself instead of one slash command kicking off the next.

Click the section that matches your editor / agent.

> Don't see your tool? Pick **Generic** at the bottom — it drops a self-contained `zama-skills-knowledge/` folder you can hand-point any AI agent at.

<details>
<summary><b>Claude Code</b> — slash commands, auto-routing, full pipeline (recommended)</summary>

### Install (one-time)

```bash
/plugin marketplace add github.com/kocaemre/zama-skills
/plugin install zama-skills@zama-skills
/zama-doctor                # verifies Node ≥ 20, pnpm, context7 + magic MCP
```

Optional alternative — install via npm without the marketplace (e.g. global personal install):

```bash
npx zama-skills@latest install --tool claude-code             # writes to ./.claude/skills (this project only)
npx zama-skills@latest install --tool claude-code --scope personal   # writes to ~/.claude/skills (every project)
```

### How to use

In any project, just type a slash command — Claude Code picks the next skill from each closing summary:

```
/zama-autonomous            # one command, full pipeline (design → … → frontend)
/zama-design                # or run skills individually:
/zama-init                  # scaffold pnpm monorepo
/zama-contract              # author confidential .sol with verified ACL
/zama-test                  # mock + Sepolia tests
/zama-audit                 # FHE-aware review (must pass before deploy)
/zama-deploy                # Sepolia + Etherscan verify (manual confirm)
/zama-frontend              # wire @zama-fhe/relayer-sdk
/zama-debug                 # match an FHE error to a fix command
/zama-doctor                # diagnose env at any time
```

### Update / Uninstall

```bash
/plugin update zama-skills                                    # marketplace install
npx zama-skills@latest uninstall --tool claude-code --force   # npx install
```

</details>

<details>
<summary><b>Cursor</b> — composer + agent rules</summary>

### Install

```bash
cd <your-project>
npx zama-skills@latest install --tool cursor --force
```

Drops the rule pack at `.cursor/rules/zama-skills/`. Cursor picks it up automatically — no restart needed.

### How to use

Open Composer (⌘+I) or the agent panel and ask in plain English:

> "init a confidential token dApp using zama-skills"
>
> "write the confidential transfer logic following the zama-skills contract rules"
>
> "wire the frontend with relayer-sdk per zama-skills/frontend.md"

The `zama-skills/README.md` inside the rules folder enumerates every skill and the hard rules to enforce.

### Uninstall

```bash
npx zama-skills@latest uninstall --tool cursor --force
```

</details>

<details>
<summary><b>Windsurf</b> — Cascade agent rules</summary>

### Install

```bash
cd <your-project>
npx zama-skills@latest install --tool windsurf --force
```

Drops the rule pack at `.windsurf/rules/zama-skills/`. Windsurf's Cascade agent reads it as project context — no restart needed in most setups.

> ⚠️ **Windsurf has a 12,000-character limit per rule file** ([source](https://docs.windsurf.com/windsurf/cascade/memories)). 8 of our 10 skill files exceed it, so Cascade will silently truncate the long ones. **Recommended:** also install `--tool generic` and tell Cascade *"for full rules, see `zama-skills-knowledge/<skill>.md`"* — Windsurf's rule files then act as the index, and the full content lives outside the 12K-capped folder.

### How to use

Open Cascade and ask in plain English:

> "init a confidential token dApp using zama-skills"
>
> "write the confidential transfer logic following zama-skills/contract.md"
>
> "wire the frontend with relayer-sdk per zama-skills/frontend.md"

The `zama-skills/README.md` inside the rules folder enumerates every skill and the hard rules to enforce.

### Uninstall

```bash
npx zama-skills@latest uninstall --tool windsurf --force
```

</details>

<details>
<summary><b>OpenCode</b> — AGENTS.md + per-skill rules</summary>

### Install

```bash
cd <your-project>
npx zama-skills@latest install --tool opencode --force
```

Drops rules at `.opencode/rules/zama-skills/` AND idempotently appends a pointer block to your `AGENTS.md` so the OpenCode agent picks the rules up automatically.

### How to use

Just ask the agent — `AGENTS.md` directs it to the right skill file:

> "follow zama-skills to scaffold a confidential ERC-7984 token"
>
> "write the deploy script per zama-skills/deploy.md"

### Uninstall

```bash
npx zama-skills@latest uninstall --tool opencode --force
```

The `AGENTS.md` pointer block is stripped automatically; the rest of your file is preserved.

</details>

<details>
<summary><b>Codex CLI (OpenAI)</b> — AGENTS.md convention</summary>

### Install

```bash
cd <your-project>
npx zama-skills@latest install --tool codex --force
```

Drops rules at `.codex/rules/zama-skills/` and appends an `AGENTS.md` pointer.

### How to use

Codex CLI scans `AGENTS.md` for project conventions. After install, run any Codex command in this directory and reference the skills by name:

> "scaffold a confidential token following zama-skills/init.md"
>
> "audit the contract per zama-skills/audit.md hard rules"

### Uninstall

```bash
npx zama-skills@latest uninstall --tool codex --force
```

</details>

<details>
<summary><b>Aider</b> — CONVENTIONS.md auto-load</summary>

### Install

```bash
cd <your-project>
npx zama-skills@latest install --tool aider --force
```

Drops rules at `.aider/zama-skills/` and appends a `CONVENTIONS.md` pointer block.

### How to use

Run aider with `--read` so it loads the conventions every session:

```bash
aider --read CONVENTIONS.md
```

Then prompt with skill-aware language:

> "/ask follow zama-skills/contract.md to add an encrypted transfer"
>
> "implement the deploy script per zama-skills/deploy.md"

### Uninstall

```bash
npx zama-skills@latest uninstall --tool aider --force
```

</details>

<details>
<summary><b>Continue (VS Code / JetBrains)</b> — agent context</summary>

### Install

```bash
cd <your-project>
npx zama-skills@latest install --tool continue --force
```

Drops rules at `.continue/rules/zama-skills/`. **Restart the Continue panel** so it re-reads the rules folder.

### How to use

Open the Continue chat and prompt with skill names:

> "init a confidential dApp following zama-skills/init.md"
>
> "review this Solidity per zama-skills/audit.md"

### Uninstall

```bash
npx zama-skills@latest uninstall --tool continue --force
```

</details>

<details>
<summary><b>Any other AI tool (Generic)</b> — portable knowledge pack</summary>

### Install

```bash
cd <your-project>
npx zama-skills@latest install --tool generic --force
```

Drops a self-contained folder at `zama-skills-knowledge/` with one markdown file per skill plus a `README.md` enumerating the hard rules. Works with any AI tool that can read project files (Codeium, JetBrains AI, custom agents, etc.).

### How to use

Tell your AI agent (in its system prompt or rules config):

> "Read `zama-skills-knowledge/README.md` and the per-skill files under that folder. Follow the **Hard rules** section verbatim when writing fhEVM code."

### Uninstall

```bash
npx zama-skills@latest uninstall --tool generic --force
```

</details>

<details>
<summary><b>🔥 Install for several tools at once</b> (or all, non-interactive CI)</summary>

```bash
# Interactive multi-select picker (Claude Code is auto-pre-selected)
npx zama-skills@latest install

# Specific tools
npx zama-skills@latest install --tool claude-code,cursor,opencode --force

# Every supported tool (CI-friendly)
npx zama-skills@latest install --all --force
```

The interactive picker auto-detects which tools you already use (`.claude/`, `.cursor/`, `AGENTS.md`, `.aider.conf.yml`, etc.) and pre-selects them.

</details>

> Re-running `install` is idempotent — it's safe to run any time you want to refresh your local copy after a `zama-skills` release.

### Where do the rules go? (project vs global scope)

`--scope project` (default) writes under `cwd` — the rules ship with your repo, your team gets them on `git pull`. **This is the right choice for almost every tool.**

`--scope personal` writes under `$HOME` — only Claude Code actually reads global rules from `~/.claude/skills/`. The other tools key off the current working directory.

| Tool | Default location (`--scope project`) | `--scope personal` works? |
|------|--------------------------------------|---------------------------|
| **Claude Code** | `<cwd>/.claude/skills/zama-skills/` | ✅ yes — `~/.claude/skills/` is real |
| **Cursor** | `<cwd>/.cursor/rules/zama-skills/` | ❌ project-local only |
| **Windsurf** | `<cwd>/.windsurf/rules/zama-skills/` | ❌ project-local only |
| **OpenCode** | `<cwd>/.opencode/rules/zama-skills/` + `<cwd>/AGENTS.md` | ❌ project-local only |
| **Codex CLI** | `<cwd>/.codex/rules/zama-skills/` + `<cwd>/AGENTS.md` | ❌ project-local only |
| **Aider** | `<cwd>/.aider/zama-skills/` + `<cwd>/CONVENTIONS.md` | ❌ project-local only |
| **Continue** | `<cwd>/.continue/rules/zama-skills/` | ❌ project-local only |
| **Generic** | `<cwd>/zama-skills-knowledge/` | ✅ either works (you wire it up) |

The CLI prints a warning if you pick `--scope personal` for a tool that won't honor it. **Recommended:** keep the default `--scope project`, commit the rule files to your repo, and let your team's AI agents pick them up automatically.

## Demo

[Live dApp on Vercel](https://zama-skills.vercel.app)
&nbsp;&nbsp;·&nbsp;&nbsp;
[Verified contract on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x04Bd105DE7a5D3297c3747cef90ac8b760136896#code)

Walkthrough: `/plugin marketplace add` → `/zama-design` → `/zama-init` → `/zama-contract` → `/zama-deploy` (live Sepolia) → MetaMask decrypt on the live dApp. A 2-minute screencast will be linked here once recorded.

## Quick Start — pick your path

After installing the plugin, jump straight to the path that matches your goal. Each path is a chain of skills; Claude Code picks the next one automatically from the closing summary, but you can also type the slash commands yourself.

### Path 0 — One command, the whole thing (~30 min, recommended for first-timers)

```
/zama-autonomous
```

Runs the full pipeline (design → init → contract → test → audit → deploy → frontend) in sequence. Pauses only at safety gates: design review, audit findings, the manual deploy confirmation, and final smoke. Resumable — if you stop or hit an error, re-run `/zama-autonomous` and it asks whether to resume from the saved step or start fresh.

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
| `/zama-init` | "init zama project", "new fhevm dapp", "scaffold confidential token", empty dir | Forks `fhevm-react-template`, asks for use-case (token / voting / auction / custom), wires pinned versions, generates `.env.example` + MetaMask Sepolia deep-link |
| `/zama-contract` | "write fhevm contract", "confidential token", "euint", "FHE.allow"; editing `.sol` in fhevm project | Authors confidential contracts with `euint`/`ebool`/`eaddress`, ACL `FHE.allowThis`, OZ Confidential Contracts (ERC-7984); rejects `require(decrypt(...))` cleartext leaks |
| `/zama-test` | "test fhevm", "mock encrypted input", "decrypt assertion", "sepolia integration test" | Generates mock + Sepolia integration tests with `@fhevm/hardhat-plugin`, decrypt assertions, HCU-budget warnings |
| `/zama-deploy` | manual only — explicit `/zama-deploy` invocation; never auto-triggers | Deploys to Sepolia + verifies on Etherscan + auto-registers Confidential Token Registry; pulls live addresses, never pins |
| `/zama-frontend` | "fhevm frontend", "relayer sdk", "useDecrypted"; editing `src/` or `app/` in fhevm project | Wires `@zama-fhe/relayer-sdk`, `useDecrypted` hook with relayer UX states, ethers v6 + typechain, encrypted-input components |
| `/zama-design` | "I have an idea", "design my dApp", "plan a confidential auction", before any scaffolding | Reads your use-case, queries context7 against `/zama-ai/fhevm` + OZ Confidential, produces `DESIGN.md` (contract architecture + ACL strategy) and `UI-WIREFRAME.md` (component tree + 4-state UX flows) |
| `/zama-audit` | "audit this contract", "check FHE bugs", post-`/zama-contract` review | Scans Solidity + TS for ACL gaps, cleartext leaks (require/event), HCU explosions (>12 FHE ops/fn), deprecated imports — exits 0/1/2 for CI |
| `/zama-debug` | "I got an FHE error", paste a stack trace | Matches your error against a 10+ pattern catalog (ACL revert, `initSDK undefined`, deprecated imports, HCU exceeded, SSR `indexedDB`, etc.) — returns root cause + fix command |
| `/zama-doctor` | "check zama setup", "what's missing", first-time install verification | Read-only diagnostic — checks Node, pnpm, git, `context7` MCP (required), `magic` MCP (recommended), Sepolia RPC reachability, plugin install status. Prints fix commands for whatever is missing. |
| `/zama-autonomous` | "do everything", "full pipeline", "build me a confidential dApp", first-time users | One-command orchestrator — runs design → init → contract → test → audit → deploy → frontend in sequence. Pauses at safety gates (design review, audit findings, manual deploy). Re-running `/zama-autonomous` after an interruption prompts you to resume from the saved step. State at `.planning/v1-autonomous/state.json`. |

`/zama-deploy` has `disable-model-invocation: true` — Claude **will not** auto-deploy on its own. You must invoke it explicitly.

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
    ├── init/SKILL.md                 ← /zama-init   (auto-invoke, context: fork)
    ├── contract/SKILL.md             ← /zama-contract
    ├── test/SKILL.md                 ← /zama-test
    ├── deploy/SKILL.md               ← /zama-deploy (manual only)
    ├── frontend/SKILL.md             ← /zama-frontend
    ├── design/SKILL.md               ← /zama-design  (plan/blueprint, v1.1)
    ├── audit/SKILL.md                ← /zama-audit   (FHE-aware code review, v1.1)
    └── debug/SKILL.md                ← /zama-debug   (error → fix matcher, v1.1)
```

The plugin is a single Claude Code marketplace at the repo root. Skill folder names drop the `zama-` prefix (the plugin namespace already supplies it) so commands read `/zama-init` not `/zama-zama-init`.

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
| 3 — `/zama-init` | Done | Headline scaffolding skill — full flow |
| 4 — Remaining 4 skills | Done | contract, test, deploy, frontend |
| 5 — Reference example dApp | Done | Confidential token deployed on Sepolia + live frontend |
| 6 — Distribution / submission | Active | npm publish, README polish, demo video, submit |

## Links

- **Repository:** [github.com/kocaemre/zama-skills](https://github.com/kocaemre/zama-skills)
- **npm package:** [npmjs.com/package/zama-skills](https://www.npmjs.com/package/zama-skills)
- **Example dApp:** [`examples/confidential-token/`](examples/confidential-token/)
- **Live demo:** [zama-skills.vercel.app](https://zama-skills.vercel.app)
- **Roadmap:** [`.planning/ROADMAP.md`](.planning/ROADMAP.md) (visible on the GitHub repo, not shipped in the npm tarball)
- **Issues / contributions:** open an issue or PR on [github.com/kocaemre/zama-skills](https://github.com/kocaemre/zama-skills/issues) — bug reports, missing patterns, and pinned-version refresh PRs all welcome.
- **License:** [`LICENSE`](LICENSE)
- **Third-party licenses:** [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md)

## License

[MIT](./LICENSE) © 2026 Emre Koca

## Acknowledgements

- [Zama](https://zama.org) — fhEVM, FHE Solidity library, hardhat plugin, relayer SDK
- [OpenZeppelin](https://www.openzeppelin.com) — Confidential Contracts (ERC-7984)
- [Anthropic](https://www.anthropic.com) — Claude Code skills + plugins format
- [context7](https://github.com/upstash/context7) — live docs MCP that powers anti-hallucination
