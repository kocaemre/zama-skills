# zama-skills

> AI agent skills that take a developer from an empty directory to a deployed confidential dApp on Sepolia in 30 minutes — without writing a single FHE primitive by hand.

**Built for:** [Zama Developer Program — Mainnet Season 2 / Bounty Track](https://docs.zama.org/protocol/community/programs).

**Differentiator:** Every generated line is verified live against official Zama documentation via [context7](https://github.com/upstash/context7) MCP — `/zama-ai/fhevm` (1,772 snippets), `/zama-ai/fhevm-hardhat-template`, `/websites/openzeppelin_confidential-contracts`. **Zero hallucinated APIs.**

<!-- Phase 6 inserts: badges row (CI · npm · Sepolia demo dApp · 90-second video) -->
<!-- TODO Phase 6: ![CI](badge) ![npm](badge) ![Sepolia demo](badge) ![video](badge) -->
<!-- Phase 6 inserts: live demo screenshot or terminal cast -->
<!-- TODO Phase 6: live demo URL → https://<vercel-url> -->
<!-- TODO Phase 6: 90-second walkthrough video → https://<youtube-url> -->

## Install

**Primary path — Claude Code plugin:**

```bash
# In Claude Code:
/plugin marketplace add https://github.com/<owner>/zama-skills
/plugin install zama-skills@zama-skills
```

**Fallback — npx (for non-Claude-Code agents or scripted setup):**

```bash
npx zama-skills install
```

> **Note:** Phase 1 (foundation) ships the plugin manifests and 5 skill skeletons. Skill bodies fill out across Phases 2–4. For the latest status see [`.planning/ROADMAP.md`](.planning/ROADMAP.md).

## Try it live

[![Vercel](https://img.shields.io/badge/Vercel-Live-black?logo=vercel)](https://zama-skills.vercel.app) [![Sepolia Verified](https://img.shields.io/badge/Sepolia-Verified-brightgreen?logo=ethereum)](https://sepolia.etherscan.io/address/0x04Bd105DE7a5D3297c3747cef90ac8b760136896#code) <!-- @sync:vercel-url -->

See [`examples/confidential-token/`](examples/confidential-token/) — a confidential ERC-7984 token (cDEMO) deployed to Sepolia at [`0x04Bd105DE7a5D3297c3747cef90ac8b760136896`](https://sepolia.etherscan.io/address/0x04Bd105DE7a5D3297c3747cef90ac8b760136896#code) and live on Vercel. Built end-to-end by running this plugin's skills against an empty directory — every contract, test, deploy script, and React component is reproducible from the recorded skill commit SHAs in [`.gsd-snapshot.json`](examples/confidential-token/.gsd-snapshot.json).

![demo](examples/confidential-token/docs/demo.gif) <!-- placeholder until Phase 6 records the real GIF -->

## What you get — 5 skills

| Slash command | When it runs | What it does |
|---------------|--------------|--------------|
| `/zama-skills:init` | "scaffold confidential dapp", empty dir | Forks `fhevm-react-template`, asks for use-case (token / voting / auction / custom), wires pinned versions, generates `.env.example` + MetaMask Sepolia deep-link |
| `/zama-skills:contract` | editing `.sol` in an fhevm project | Authors confidential contracts with correct `euint`/`ebool`/`eaddress`, ACL `FHE.allowThis`, OZ Confidential Contracts (ERC-7984); rejects `require(decrypt(...))` cleartext leaks |
| `/zama-skills:test` | "test fhevm", "mock encrypted input" | Generates mock + Sepolia integration tests with `@fhevm/hardhat-plugin`, decrypt assertions, HCU-budget warnings |
| `/zama-skills:deploy` | manual only — won't auto-trigger | Deploys to Sepolia + verifies on Etherscan + auto-registers Confidential Token Registry; pulls live addresses, never pins |
| `/zama-skills:frontend` | editing `src/` in an fhevm project | Wires `@zama-fhe/relayer-sdk`, `useDecrypted` hook with relayer UX states, ethers v6 + typechain, encrypted-input components |

`/zama-skills:deploy` has `disable-model-invocation: true` — Claude **will not** auto-deploy on its own. You must invoke it explicitly.

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
    └── frontend/SKILL.md             ← /zama-skills:frontend
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
| 1 — Plugin Foundation + CI | Active | Marketplace + manifests + 5 SKILL.md skeletons + CI gating |
| 2 — Shared Infrastructure | Pending | Pinned versions, deprecated-imports list, transclusion build engine |
| 3 — `/zama-skills:init` | Pending | Headline scaffolding skill — full flow |
| 4 — Remaining 4 skills | Pending | contract, test, deploy, frontend |
| 5 — Reference example dApp | Pending | Confidential token deployed on Sepolia + live frontend |
| 6 — Distribution / submission | Pending | npm publish, README polish, demo video, submit |

<!-- TODO Phase 6: expand "Demo" section with live dApp URL, 90s video embed, screenshots -->
<!-- TODO Phase 6: add "Published on npm" badge once package is live -->

## License

[MIT](./LICENSE) © 2026 Emre Koca

## Acknowledgements

- [Zama](https://www.zama.ai) — fhEVM, FHE Solidity library, hardhat plugin, relayer SDK
- [OpenZeppelin](https://www.openzeppelin.com) — Confidential Contracts (ERC-7984)
- [Anthropic](https://www.anthropic.com) — Claude Code skills + plugins format
- [context7](https://github.com/upstash/context7) — live docs MCP that powers anti-hallucination
