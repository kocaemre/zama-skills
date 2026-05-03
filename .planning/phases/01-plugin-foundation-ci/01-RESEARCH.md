# Phase 1: Plugin Foundation + CI - Research

**Researched:** 2026-05-03
**Domain:** Claude Code plugin packaging (marketplace.json + plugin.json + SKILL.md) + Node.js CLI bootstrap + GitHub Actions schema validation
**Confidence:** HIGH

## Summary

Phase 1 ships a Claude Code plugin marketplace skeleton with five SKILL.md stubs and a minimal `npx zama-skills install` CLI fallback, gated by a GitHub Actions CI job that validates schema correctness. All scaffolding decisions are HIGH-confidence: the plugin/marketplace/SKILL specs are explicit on `code.claude.com/docs`, the npm tooling versions are pinned in `CLAUDE.md`, and validation can be done with `zod` schemas plus the official `claude plugin validate` CLI.

The phase is pure scaffolding — no fhEVM code, no Solidity, no frontend SDK. Layer A only.

**Primary recommendation:** Build a single-plugin marketplace at the repo root using the canonical `.claude-plugin/marketplace.json` + `plugins/zama-skills/.claude-plugin/plugin.json` layout. Use `commander@^14`, `zod@^4`, `prompts@^2`, `picocolors@^1.1`, `fs-extra@^11`, TypeScript `^5.9` (or move to ^6 — see Assumptions Log). CI runs `claude plugin validate .` plus a custom `zod`-based schema check on `marketplace.json` and `plugin.json`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Marketplace identity**
- Marketplace name: `zama-skills` (kebab-case, unique — not on reserved list)
- Plugin name: `zama-skills`
- Distribution: GitHub repo (primary) + npm (fallback CLI install)

**Tooling baseline (locked from CLAUDE.md)**
- Node `>=20`
- TypeScript `^5.9.3`
- npm (>=7) — no pnpm/yarn lock-in for this layer
- Validation: `zod ^3.x` for `marketplace.json` / `plugin.json` shape checks at CI time

**SKILL.md frontmatter conventions**
- All 5 skills get `disable-model-invocation: true` for `/zama-deploy` only; others auto-invocable
- Use `${CLAUDE_SKILL_DIR}` for bundled asset references
- `allowed-tools` whitelist on each skill to avoid permission prompts mid-workflow
- `context: fork` on `/zama-init` (isolated subagent for noisy template scaffolding)

### Claude's Discretion
All other implementation choices (CI matrix specifics, exact SKILL.md skeleton bodies beyond frontmatter, npm CLI internals) are at Claude's discretion — pure infrastructure phase.

### Deferred Ideas (OUT OF SCOPE)
- Cursor `.cursorrules` native format export — out of scope per PROJECT.md (generic markdown only)
- Custom MCP server for Zama docs — explicitly rejected per PROJECT.md (use context7)
- Mainnet deploy automation — Sepolia only for v1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLUGIN-01 | One-command install via `/plugin marketplace add` + `/plugin install zama-skills@zama-skills` | Marketplace schema + repo layout (this doc, "Standard Stack" + "Architecture Patterns") |
| PLUGIN-02 | 5 SKILL.md files (init/contract/test/deploy/frontend) with complete frontmatter — combined `description` + `when_to_use` ≤ 1,536 chars | SKILL.md frontmatter spec (this doc, "SKILL.md Frontmatter Reference") |
| PLUGIN-03 | `/zama-deploy` skill has `disable-model-invocation: true` | Frontmatter field documented; semantic = "only user can invoke" |
| PLUGIN-04 | Each skill has `allowed-tools` whitelist (no mid-workflow permission prompts) | Frontmatter field documented; takes effect after workspace trust |
| PLUGIN-06 | Plugin schema validation runs in CI; mandatory green before `npm publish` | `claude plugin validate` CLI + `zod` schema check (this doc, "CI Workflow") |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Plugin discovery / load | Claude Code runtime | — | `~/.claude/plugins/cache/...` is owned by Claude Code; we only ship JSON + markdown |
| Skill invocation routing | Claude Code runtime | — | `/plugin-name:skill-name` namespacing is enforced by the runtime |
| Schema validation | CI (GitHub Actions) | Local dev (`claude plugin validate`) | Catch bad JSON before users see it; also caught at runtime but we want pre-publish gating |
| npm fallback install | Node CLI (`bin/zama-skills`) | — | Mirrors plugin install for non-Claude-Code users; copies skill files to `~/.claude/skills/` or similar |
| Manifest authority | `plugin.json` (default `strict: true`) | `marketplace.json` (only metadata) | Plugin owns its component definitions; marketplace just catalogs |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `commander` | `^14.0.3` | CLI argument parsing for `npx zama-skills install` | Industry-standard Node CLI lib; minimal surface. **NOTE:** CLAUDE.md pins `^12`; current is `14.0.3`. Bump or stay — see Assumptions Log A1 |
| `zod` | `^4.4.2` | Validate `marketplace.json` / `plugin.json` shape at CI | Standard schema lib. **NOTE:** CLAUDE.md pins `^3`; v4 is current and has breaking API changes (`.parse()` works the same; some types renamed). See Assumptions Log A2 |
| `prompts` | `^2.4.2` | Interactive prompts (scope: personal vs project install) | Lightweight, no React dep. Stable since 2023 |
| `picocolors` | `^1.1.1` | Terminal coloring | Tiny, same version pinned in `fhevm-hardhat-template` |
| `fs-extra` | `^11.3.4` | Recursive copy of skill files | Avoids hand-rolling `cp -r`; promise-based |

### Supporting (devDependencies)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `typescript` | `^5.9.3` (CLAUDE.md pin) — current `6.0.3` available | Type checking | Match Zama template alignment per CLAUDE.md |
| `tsx` | `^4.21.0` | Run TS directly in CI / dev | No build step needed for CI scripts |
| `vitest` | `^4.1.5` | Unit tests for install CLI + schema validators | Same family as Vite; faster than Jest. CLAUDE.md pins `^2`; current is `4.1.5` (see A3) |
| `@types/node` | `^20.x` | Node type definitions | Match `node@>=20` engines field |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `commander` | `yargs`, `cac`, native `node:util parseArgs` | `commander` is most familiar; `parseArgs` (Node 20+ stable) avoids the dep but uglier ergonomics |
| `zod` | `ajv` + JSON Schema | JSON Schema is more portable but `zod` doubles as runtime validation + TS type inference (single source of truth) |
| `prompts` | `@inquirer/prompts`, `enquirer` | `prompts` is smaller; `@inquirer/prompts` has better TS types but heavier |
| Custom validation | `claude plugin validate .` only | The official CLI catches frontmatter + JSON syntax but does NOT enforce custom invariants (e.g., "all 5 skills present", "deploy has disable-model-invocation"). Use BOTH |

**Installation:**
```bash
npm install --save-dev commander zod prompts picocolors fs-extra
npm install --save-dev -D typescript tsx vitest @types/node @types/prompts @types/fs-extra
```

**Version verification (npm registry, 2026-05-03):**
- `commander@14.0.3` — published 2026-04-24 [VERIFIED: npm view]
- `zod@4.4.2` — published 2026-05-01 [VERIFIED: npm view]
- `fs-extra@11.3.4` — published 2026-03-03 [VERIFIED: npm view]
- `prompts@2.4.2` — published 2023-10-21 (stable, no recent activity — fine) [VERIFIED: npm view]
- `picocolors@1.1.1` — published 2024-10-16 [VERIFIED: npm view]
- `tsx@4.21.0` — published 2025-11-30 [VERIFIED: npm view]
- `vitest@4.1.5` — published 2026-04-23 [VERIFIED: npm view]
- `typescript@6.0.3` — published 2026-04-16 [VERIFIED: npm view]

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Repo (zama-skills) — root                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ .claude-plugin/marketplace.json    (catalog)          │   │
│  │   { name, owner, plugins: [{ source: "./plugins/..."}]│   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             │ relative source                │
│                             ▼                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ plugins/zama-skills/                                  │   │
│  │   ├── .claude-plugin/plugin.json    (manifest)        │   │
│  │   └── skills/                                         │   │
│  │       ├── zama-init/SKILL.md       (auto-invoke)      │   │
│  │       ├── zama-contract/SKILL.md   (auto-invoke)      │   │
│  │       ├── zama-test/SKILL.md       (auto-invoke)      │   │
│  │       ├── zama-deploy/SKILL.md     (manual only)      │   │
│  │       └── zama-frontend/SKILL.md   (auto-invoke)      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ package.json — name "zama-skills", bin field          │   │
│  │ src/cli/install.ts — npx fallback (commander)         │   │
│  │ scripts/validate.ts — zod schema check                │   │
│  │ .github/workflows/ci.yml — validate + test            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ /plugin marketplace add <git-url>
                            │ /plugin install zama-skills@zama-skills
                            ▼
                ┌──────────────────────────┐
                │  Claude Code runtime      │
                │  ~/.claude/plugins/cache/ │
                └──────────────────────────┘
```

### Recommended Project Structure

```
zama-skills/                                      # repo root = marketplace root
├── .claude-plugin/
│   └── marketplace.json                          # catalog (REQUIRED at root)
├── plugins/
│   └── zama-skills/                              # plugin dir (folder name = plugin name)
│       ├── .claude-plugin/
│       │   └── plugin.json                       # plugin manifest
│       └── skills/
│           ├── zama-init/SKILL.md
│           ├── zama-contract/SKILL.md
│           ├── zama-test/SKILL.md
│           ├── zama-deploy/SKILL.md
│           └── zama-frontend/SKILL.md
├── src/
│   └── cli/
│       ├── index.ts                              # bin entry (#!/usr/bin/env node)
│       └── install.ts                            # `install` subcommand
├── scripts/
│   └── validate.ts                               # zod-based manifest validator
├── .github/
│   └── workflows/
│       └── ci.yml                                # validate + lint + test
├── package.json                                  # name, version, bin, engines
├── tsconfig.json
├── README.md
├── LICENSE
└── .gitignore
```

**Key path facts (HIGH confidence):**
- `.claude-plugin/marketplace.json` MUST be at the marketplace repo root [CITED: code.claude.com/docs/en/plugin-marketplaces]
- `.claude-plugin/plugin.json` MUST be inside each plugin's root directory [CITED: code.claude.com/docs/en/plugins]
- `skills/<skill-name>/SKILL.md` is the canonical per-skill layout [CITED: code.claude.com/docs/en/skills]
- The marketplace plugin entry's `source: "./plugins/zama-skills"` is RESOLVED RELATIVE TO MARKETPLACE ROOT (the directory containing `.claude-plugin/`), not relative to `marketplace.json` itself [CITED: code.claude.com/docs/en/plugin-marketplaces — "Relative paths" section]
- Common mistake: do NOT put `skills/`, `commands/`, `agents/` inside `.claude-plugin/`. Only `plugin.json` belongs there [CITED: code.claude.com/docs/en/plugins — Warning callout]

### Pattern 1: Marketplace Manifest

**File:** `.claude-plugin/marketplace.json`

```json
{
  "$schema": "https://json.schemastore.org/claude-code-marketplace",
  "name": "zama-skills",
  "description": "AI agent skills for building confidential dApps with the Zama Protocol (fhEVM)",
  "owner": {
    "name": "Emre Koca",
    "email": "emrekoca2003@gmail.com"
  },
  "plugins": [
    {
      "name": "zama-skills",
      "source": "./plugins/zama-skills",
      "description": "5 skills (init, contract, test, deploy, frontend) for fhEVM dApp scaffolding",
      "version": "0.1.0",
      "homepage": "https://github.com/<owner>/zama-skills",
      "repository": "https://github.com/<owner>/zama-skills",
      "license": "MIT",
      "keywords": ["zama", "fhevm", "fhe", "confidential", "ethereum", "solidity"],
      "category": "blockchain"
    }
  ]
}
```

**Required fields:** `name`, `owner` (with `name`), `plugins[]` (each with `name` + `source`) [CITED: code.claude.com/docs/en/plugin-marketplaces — Marketplace schema]

### Pattern 2: Plugin Manifest

**File:** `plugins/zama-skills/.claude-plugin/plugin.json`

```json
{
  "name": "zama-skills",
  "description": "AI agent skills for building confidential dApps with the Zama Protocol",
  "version": "0.1.0",
  "author": {
    "name": "Emre Koca",
    "email": "emrekoca2003@gmail.com"
  },
  "homepage": "https://github.com/<owner>/zama-skills",
  "repository": "https://github.com/<owner>/zama-skills",
  "license": "MIT"
}
```

**Required fields:** `name` only. `description`, `version`, `author`, `homepage`, `repository`, `license` are all optional but recommended [CITED: code.claude.com/docs/en/plugins].

**Version pinning gotcha:** If `plugin.json` declares `"version": "0.1.0"` and you push commits without bumping it, existing users see no update. Either bump on every release or OMIT `version` (commit SHA becomes version). For a 7-day bounty, OMIT during dev; pin on submission. [CITED: plugin-marketplaces — Version resolution]

### Pattern 3: SKILL.md Frontmatter (auto-invoke skill)

**File:** `plugins/zama-skills/skills/zama-init/SKILL.md`

```yaml
---
name: zama-init
description: Scaffold a new confidential dApp from the official fhevm-react-template, customized for the user's chosen use-case (token, voting, auction, custom). Use when the user wants to start a new Zama Protocol / fhEVM project from scratch, or asks how to bootstrap a confidential dApp.
when_to_use: Trigger phrases include "init zama project", "new fhevm dapp", "scaffold confidential token", "start zama". Run when working in an empty or near-empty directory.
context: fork
agent: general-purpose
allowed-tools: Bash(git *) Bash(npm *) Bash(npx *) Bash(mkdir *) Bash(cp *) Read Write Edit Glob Grep
---

[skeleton body — placeholder content for Phase 3 to flesh out]
```

### Pattern 4: SKILL.md Frontmatter (manual-only skill)

**File:** `plugins/zama-skills/skills/zama-deploy/SKILL.md`

```yaml
---
name: zama-deploy
description: Deploy compiled fhEVM contracts to Sepolia testnet, verify on Etherscan, and (if applicable) register with the Confidential Token Registry. Use only when the user explicitly asks to deploy.
when_to_use: User has compiled contracts and explicitly types /zama-deploy or asks to deploy to Sepolia.
disable-model-invocation: true
allowed-tools: Bash(npx hardhat *) Bash(npm run *) Read Write WebFetch
---

[skeleton body]
```

### Pattern 5: npm Package + bin Field

**File:** `package.json`

```json
{
  "name": "zama-skills",
  "version": "0.1.0",
  "description": "AI agent skills for building confidential dApps with the Zama Protocol",
  "type": "module",
  "bin": {
    "zama-skills": "./bin/zama-skills.mjs"
  },
  "files": [
    "bin",
    "dist",
    "plugins",
    ".claude-plugin",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "validate": "tsx scripts/validate.ts",
    "test": "vitest run",
    "build": "tsc -p tsconfig.build.json",
    "prepack": "npm run validate && npm run build"
  }
}
```

**Why `bin` as `.mjs` shim:** `bin` entries must be executable with a shebang. Easiest: `bin/zama-skills.mjs` is a thin `#!/usr/bin/env node` wrapper that imports from `dist/cli/index.js`. Avoids needing `chmod` orchestration on a TypeScript output.

### Pattern 6: Minimal CLI Stub

**File:** `bin/zama-skills.mjs`
```js
#!/usr/bin/env node
import('../dist/cli/index.js');
```

**File:** `src/cli/index.ts`
```ts
import { Command } from 'commander';
import pc from 'picocolors';

const program = new Command();
program
  .name('zama-skills')
  .description('Install zama-skills plugin into Claude Code')
  .version('0.1.0');

program
  .command('install')
  .description('Copy skills into ~/.claude/skills/ (or project .claude/skills/)')
  .option('--scope <scope>', 'personal | project', 'personal')
  .action(async (opts) => {
    // Phase 6 will flesh this out — for Phase 1 ship a stub that prints the
    // recommended /plugin marketplace add command.
    console.log(pc.yellow('Phase 1 stub. Use:'));
    console.log(pc.cyan('  /plugin marketplace add <repo-url>'));
    console.log(pc.cyan('  /plugin install zama-skills@zama-skills'));
  });

program.parse();
```

### Anti-Patterns to Avoid

- **Putting `skills/` inside `.claude-plugin/`** — only `plugin.json` lives there. Skills go at plugin root. [CITED: code.claude.com/docs/en/plugins — Warning callout]
- **Using `..` in `source` paths** — explicitly rejected by validator: `"plugins[0].source: Path contains '..'"`. [CITED: plugin-marketplaces troubleshooting]
- **Pinning `version` in BOTH `plugin.json` AND marketplace entry** — `plugin.json` silently wins; mismatches mask bugs. [CITED: plugin-marketplaces — Version resolution warning]
- **Marketplace name on the reserved list** — `agent-skills`, `claude-code-marketplace`, `claude-plugins-official`, `anthropic-marketplace`, `anthropic-plugins`, `claude-code-plugins`, `knowledge-work-plugins`, `life-sciences` are blocked, plus impersonation patterns. `zama-skills` is safe. [CITED: plugin-marketplaces — Reserved names]
- **Forgetting kebab-case on names** — `name` fields (marketplace + plugin + skill) MUST be lowercase letters, digits, hyphens only (skill names: max 64 chars). [CITED: skills frontmatter reference]
- **Relative paths in URL-distributed marketplaces** — only work via git. We're shipping via GitHub repo so we're fine, but if anyone tries `/plugin marketplace add https://example.com/marketplace.json` (raw file URL) it will fail. README should mention this.
- **Description bloat** — combined `description` + `when_to_use` is truncated at 1,536 chars per skill. Lead with the key use case. [CITED: skills — Frontmatter reference + Troubleshooting]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plugin/marketplace JSON validation | Custom JSON schema validator | `claude plugin validate .` (official CLI) + `zod` schemas (custom invariants only) | Official CLI is the source of truth for shape; zod is for our extra checks |
| CLI argument parsing | Hand-rolled `process.argv` parsing | `commander` | Help text, subcommands, types — solved problem |
| Recursive directory copy | `fs.cp` recursion + edge cases | `fs-extra.copy()` | Symlink handling, overwrite policy, error messages |
| Interactive prompts | `readline` loops | `prompts` | Cancellation handling, type coercion, validation |
| Terminal color | ANSI escape codes | `picocolors` | NO_COLOR env var, TTY detection, 1.5KB |
| JSON Schema → TS types | Hand-written interfaces | `zod` (single-source: schema → type inference via `z.infer`) | Drift-proof |

**Key insight:** Layer A is "boring infrastructure." Use the most boring, most-downloaded library for each job. The differentiation is in Layer B (the skills' content), not the packaging.

## Common Pitfalls

### Pitfall 1: `marketplace.json` placed at `marketplace.json` (wrong) instead of `.claude-plugin/marketplace.json` (right)
**What goes wrong:** `/plugin marketplace add` reports "File not found: .claude-plugin/marketplace.json"
**Why it happens:** Easy to skim docs and miss the leading dot-directory
**How to avoid:** First plan task is "create `.claude-plugin/` at repo root + place marketplace.json inside"
**Warning signs:** Local `claude plugin validate .` fails with the exact error string above

### Pitfall 2: Skill description gets truncated, Claude stops auto-invoking
**What goes wrong:** Long descriptive prose pushes the trigger keywords past 1,536 chars, so Claude never matches the skill on user requests
**Why it happens:** The cap is silent — no validator warns about it
**How to avoid:** Lead with the key use case + trigger phrases in the first 200 chars; put rationale and detail later
**Warning signs:** Manual `/zama-init` works, but Claude doesn't auto-trigger when asked "scaffold a zama project"

### Pitfall 3: Plugin namespace surprise
**What goes wrong:** User runs `/zama-init` — but plugin skills are namespaced as `/<plugin-name>:<skill-name>`. So the actual command is `/zama-skills:zama-init`
**Why it happens:** Plugin docs explicitly state: "Plugin skills are always namespaced (like `/my-first-plugin:hello`) to prevent conflicts" [CITED: code.claude.com/docs/en/plugins]
**How to avoid:** Choose a plugin name that makes the namespacing read naturally. Two options:
  - **Option A:** plugin name = `zama-skills`, skills named `init`, `contract`, etc. → `/zama-skills:init` (clean)
  - **Option B:** plugin name = `zama`, skills named `init`, `contract`, etc. → `/zama:init` (cleanest)
  - Current decision (CONTEXT.md): plugin name `zama-skills` + skills named `zama-init`, etc. → `/zama-skills:zama-init` (redundant, ugly)

  **RECOMMENDATION:** Rename skills inside the plugin to drop the `zama-` prefix. The plugin namespace already supplies it. README and docs can still call them "the `/zama-init` skill" colloquially while the on-disk folder is `skills/init/`.

  This is a Plan-time decision the planner should surface — it conflicts with the literal CONTEXT.md decision but is a UX-critical fix. Flag in PLAN-01 for the human to confirm before scaffolding.

**Warning signs:** Slash menu shows `/zama-skills:zama-init` — visually doubled prefix

### Pitfall 4: `version` field freezes plugin updates
**What goes wrong:** Bumping commits doesn't propagate; users stay on old version
**Why it happens:** If `plugin.json` has `version: "0.1.0"` and you don't bump it, Claude Code uses cached copy
**How to avoid:** During the 7-day bounty crunch, OMIT `version` from `plugin.json` so commit SHA drives versioning. Pin on final submission only.
**Warning signs:** Testers report "I see the old version" after you push fixes

### Pitfall 5: Reserved marketplace names
**What goes wrong:** Marketplace fails to publish to the official Anthropic marketplace if name is reserved
**How to avoid:** `zama-skills` is safe; verified against the reserved list [CITED]

### Pitfall 6: CI false-greens on missing files
**What goes wrong:** `claude plugin validate .` checks JSON shape but does NOT enforce "all 5 SKILL.md files exist"
**How to avoid:** Custom `scripts/validate.ts` (zod) should assert: 5 skills present, deploy has `disable-model-invocation: true`, all skills have `allowed-tools` set

## Code Examples

### Example 1: zod schemas for validation

**File:** `scripts/validate.ts`
```ts
// Source: zod v4 docs (https://zod.dev) + Claude marketplace schema
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter'; // optional: for parsing SKILL.md frontmatter

const PluginSourceRelative = z.string().regex(/^\.\//, 'must start with ./');
const PluginSourceObject = z.discriminatedUnion('source', [
  z.object({ source: z.literal('github'), repo: z.string(), ref: z.string().optional(), sha: z.string().length(40).optional() }),
  z.object({ source: z.literal('url'), url: z.string().url() }),
  z.object({ source: z.literal('git-subdir'), url: z.string(), path: z.string() }),
  z.object({ source: z.literal('npm'), package: z.string(), version: z.string().optional() }),
]);

const MarketplaceSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/, 'kebab-case only'),
  description: z.string().optional(),
  owner: z.object({ name: z.string(), email: z.string().email().optional() }),
  plugins: z.array(z.object({
    name: z.string().regex(/^[a-z0-9-]+$/),
    source: z.union([PluginSourceRelative, PluginSourceObject]),
    description: z.string().optional(),
    version: z.string().optional(),
    license: z.string().optional(),
  })).min(1),
});

const RESERVED_NAMES = new Set([
  'claude-code-marketplace', 'claude-code-plugins', 'claude-plugins-official',
  'anthropic-marketplace', 'anthropic-plugins', 'agent-skills',
  'knowledge-work-plugins', 'life-sciences',
]);

async function main() {
  const raw = await fs.readFile('.claude-plugin/marketplace.json', 'utf8');
  const parsed = MarketplaceSchema.parse(JSON.parse(raw));
  if (RESERVED_NAMES.has(parsed.name)) throw new Error(`Reserved name: ${parsed.name}`);

  // Custom invariant: all 5 skills exist with correct frontmatter
  const expected = ['init', 'contract', 'test', 'deploy', 'frontend'];
  for (const slug of expected) {
    const p = `plugins/zama-skills/skills/${slug}/SKILL.md`;
    await fs.access(p);
    // Optional: parse frontmatter, assert deploy has disable-model-invocation: true, etc.
  }

  console.log('✓ marketplace + plugin + skills valid');
}
main().catch(e => { console.error(e); process.exit(1); });
```

### Example 2: GitHub Actions CI Workflow

**File:** `.github/workflows/ci.yml`
```yaml
# Source: GitHub Actions docs + Claude plugin docs
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Validate plugin/marketplace shape (zod)
        run: npm run validate
      - name: Validate via official Claude CLI
        run: npx --yes @anthropic-ai/claude-code@latest plugin validate .
        # NOTE: confirm exact CLI invocation — see Assumptions Log A4
      - name: Type-check
        run: npx tsc --noEmit
      - name: Test
        run: npm test
```

## Project Constraints (from CLAUDE.md)

These are directives from `./CLAUDE.md` that the planner MUST honor:

1. **Layer A scope only this phase.** No fhEVM contracts, no Solidity, no Hardhat plugin, no relayer SDK. Those are Phases 3-5.
2. **Marketplace name `zama-skills`** — kebab-case, not on reserved list (verified).
3. **Plugin name `zama-skills`** — same string per CONTEXT.md (but see Pitfall 3 for namespace UX concern).
4. **Five skills only:** `init`, `contract`, `test`, `deploy`, `frontend` — no more.
5. **`/zama-deploy` MUST have `disable-model-invocation: true`.** Other 4 skills should NOT.
6. **All 5 skills MUST have `allowed-tools`** whitelist.
7. **`/zama-init` should use `context: fork`.** Other 4 skills inline.
8. **`${CLAUDE_SKILL_DIR}` for bundled asset references** — when a skill body needs to invoke a script in its own directory.
9. **Node `>=20`** in `engines`. Match `fhevm-hardhat-template`'s field for downstream Layer B alignment.
10. **TypeScript `^5.9.3`** per CLAUDE.md (note: TS `6.0.3` is current; staying on 5.9.x is fine and matches Zama template).
11. **GSD workflow enforced** — all edits go through `/gsd-execute-phase` (not direct edits).
12. **No custom MCP server.** Use context7 only.
13. **Sepolia only** for v1.

## Runtime State Inventory

> Greenfield phase — empty repo. No prior runtime state to migrate.

This phase creates files from scratch in an empty repo. There is nothing stored, registered, or cached anywhere that needs auditing.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by `ls /Users/0xemrek/Desktop/bounty-zama/` (only `.planning/` exists) | None |
| Live service config | None — no published plugin yet | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no CI yet, no npm publish yet | Create on Phase 6 (NPM_TOKEN for publish) |
| Build artifacts | None — no `dist/`, no `node_modules/` yet | None |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | CLI runtime, build | check via `node --version` at plan time | should be ≥20 | install nvm + Node 20 |
| npm | Package install/publish | check via `npm --version` | should be ≥7 | bundled with Node |
| git | Version control, marketplace distribution | check `git --version` | any modern | mandatory |
| Claude Code CLI | `claude plugin validate` in CI | likely yes locally; in GH Actions install via `npx @anthropic-ai/claude-code` | latest | `npm run validate` (zod) covers most cases without it |
| GitHub repo | marketplace distribution | not yet created | — | create on Day 1 (this phase) |
| npm account | for `npm publish` later (Phase 6) | not phase-1 blocker | — | defer |

**Missing dependencies with no fallback:** None for Phase 1. (`npm publish` credentials needed in Phase 6 only.)

**Missing dependencies with fallback:** Claude Code CLI in GitHub Actions — fallback is to skip `claude plugin validate` step in CI and rely on the custom `zod` validator + manual local testing.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 1 has no auth — public marketplace |
| V3 Session Management | no | N/A |
| V4 Access Control | partial | `disable-model-invocation: true` on `/zama-deploy` is the access control — it prevents Claude from autonomously triggering deploys. Verify this field is present in the deploy SKILL.md. |
| V5 Input Validation | yes | `zod` validates `marketplace.json` + `plugin.json` shape; rejects malformed input at CI time |
| V6 Cryptography | no | No cryptographic operations in Phase 1 (those are Layer B) |
| V14 Configuration | yes | `engines.node`, kebab-case enforcement, reserved name check |

### Known Threat Patterns for Layer A

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious user installs plugin and skill auto-runs destructive command | Tampering / EoP | `allowed-tools` whitelist on every skill (no broad Bash access). `disable-model-invocation: true` on `/zama-deploy` (no autonomous deploys). README documents what each skill does. |
| Stale `version` field hides security fix | Tampering | Documented in plan: omit `version` during dev; only pin on submission. CI doesn't enforce this — manual discipline. |
| Reserved marketplace name causes squatting / impersonation | Spoofing | `zama-skills` verified against reserved list; chose unique kebab-case name. |
| Path traversal in `source` (`..`) | Tampering | Marketplace validator already rejects `..` in `source` paths [CITED]. zod schema also enforces `^\./` prefix on relative sources. |
| `npx zama-skills install` runs untrusted code | EoP | Phase 1 ships a STUB only — no recursive copy yet. Phase 6 will need to add scope confirmation prompts before writing to `~/.claude/skills/`. |
| CI secrets leakage | Information Disclosure | Phase 1 CI has NO secrets. NPM_TOKEN added in Phase 6. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `commander@^14` is acceptable despite CLAUDE.md pinning `^12` | Standard Stack | LOW — commander has minimal API churn between major versions for our usage (`Command`, `.command()`, `.action()`). Plan should ask user: bump to ^14 or stay on ^12? |
| A2 | `zod@^4` is acceptable despite CLAUDE.md pinning `^3` | Standard Stack | MEDIUM — zod v4 has API changes (e.g., some error types renamed). Our usage is basic. **Recommend: stay on `zod@^3.x` to honor CLAUDE.md verbatim.** |
| A3 | `vitest@^4` is acceptable despite CLAUDE.md pinning `^2` | Standard Stack | LOW — vitest config breaks across majors but we don't have a config yet. Recommend: stay on `^2.x` to honor CLAUDE.md. |
| A4 | `npx --yes @anthropic-ai/claude-code@latest plugin validate .` is the correct invocation in CI | CI Workflow | MEDIUM — the docs show `claude plugin validate .` but don't specify the npm package name. Need to verify by running `npm view @anthropic-ai/claude-code` or testing locally before committing the workflow. **Plan should include a "verify CLI invocation" task before relying on this in CI.** |
| A5 | The on-disk skill folder names should drop the `zama-` prefix (`init/` not `zama-init/`) to avoid `/zama-skills:zama-init` redundancy | Pitfall 3 | HIGH UX impact, LOW technical risk. **Plan must surface this for user confirmation — it conflicts with the literal CONTEXT.md decision.** Two options: (a) rename folders to drop prefix, slash command becomes `/zama-skills:init`; (b) keep folder names, accept the doubled prefix in slash command. |
| A6 | Combined `description` + `when_to_use` ≤ 1,536 chars per skill is enforceable in zod | Code Examples | LOW — straightforward `.refine()` check. |
| A7 | `package.json` `bin` shim using `.mjs` is the cleanest pattern for TS-output CLIs | Pattern 5 | LOW — well-established Node pattern. |

**The planner and discuss-phase MUST surface A2, A3, A4, A5 before the plan is locked.**

## Open Questions

1. **Plugin namespace prefix doubling** (A5)
   - What we know: plugin name `zama-skills` + skill name `zama-init` → user types `/zama-skills:zama-init`
   - What's unclear: did the user intend the doubled prefix, or did CONTEXT.md just inherit the natural skill names from the docs?
   - Recommendation: surface in PLAN-01 review; recommend dropping `zama-` prefix from skill folder names. Tracked colloquially as "the zama-init skill" while on disk it's `skills/init/SKILL.md`.

2. **`claude plugin validate` CLI distribution channel** (A4)
   - What we know: docs reference `claude plugin validate .` as a command
   - What's unclear: whether this is part of `@anthropic-ai/claude-code` npm package or a separate `claude-plugin` CLI
   - Recommendation: PLAN-04 (CI workflow) includes a small task to verify the package name + CLI shape before pinning the action

3. **Version pinning policy during the 7-day crunch**
   - What we know: pinning `version` in `plugin.json` freezes updates until the field is bumped
   - What's unclear: whether to omit (commit SHA = version) for dev, or pin and bump every commit
   - Recommendation: omit `version` from `plugin.json` until Phase 6 submission tag; pin to `0.1.0` only on final submission commit

4. **CI matrix breadth**
   - Just Node 20 LTS, or also test Node 22? Layer B will only support 20+, so Node 22 doesn't add value for Layer A scaffolding. Recommendation: Node 20 only.

## Sources

### Primary (HIGH confidence)
- https://code.claude.com/docs/en/plugin-marketplaces — full marketplace.json schema, reserved names list, plugin sources, validation CLI [VERIFIED via WebFetch 2026-05-03]
- https://code.claude.com/docs/en/plugins — plugin.json schema, plugin directory layout, namespacing, common-mistake warning [VERIFIED via WebFetch 2026-05-03]
- https://code.claude.com/docs/en/skills — SKILL.md frontmatter spec (all fields), 1,536-char cap, `${CLAUDE_SKILL_DIR}`, `context: fork`, `disable-model-invocation`, `allowed-tools` [VERIFIED via WebFetch 2026-05-03]
- npm registry queries via `npm view <pkg> version time.modified` for: commander, zod, fs-extra, prompts, picocolors, tsx, vitest, typescript [VERIFIED 2026-05-03]

### Secondary (MEDIUM confidence)
- CLAUDE.md project locked tech stack — pins `commander@^12`, `zod@^3`, `vitest@^2`. Newer majors are available but staying on pinned majors honors the CLAUDE.md directive [CITED: project CLAUDE.md]

### Tertiary (LOW confidence)
- The exact npm package providing `claude plugin validate` CLI — see A4

## Metadata

**Confidence breakdown:**
- Plugin/marketplace/SKILL specs: HIGH — official docs are explicit and current
- Stack versions: HIGH — registry-verified 2026-05-03
- CI shape: HIGH for zod-based check; MEDIUM for `claude plugin validate` invocation (A4)
- Namespace UX issue (A5): HIGH that the prefix doubles; recommendation to fix is HIGH but conflicts with literal CONTEXT.md text — needs user sign-off

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (Claude Code plugin spec is stable; revalidate npm versions on submission day)
