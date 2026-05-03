# Phase 1: Plugin Foundation + CI - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

A judge can run `/plugin marketplace add` + `/plugin install zama-skills@zama-skills` against the GitHub repo and the plugin loads cleanly with all 5 SKILL.md skeletons recognized.

Deliverables:
- Repo skeleton with `.claude-plugin/marketplace.json` and `plugin.json`
- 5 SKILL.md skeleton files in `plugins/zama-skills/skills/{init,contract,test,deploy,frontend}/SKILL.md` — invoked as `/zama-skills:init`, `/zama-skills:contract`, etc. (plugin-namespaced; skill folder names drop the `zama-` prefix to avoid `/zama-skills:zama-init` doubling)
- npm package skeleton (`package.json` with `npx zama-skills install` CLI stub)
- CI: GitHub Actions workflow that validates plugin/marketplace JSON shapes and runs basic install smoke test
- README skeleton

</domain>

<decisions>
## Implementation Decisions

### Marketplace identity
- Marketplace name: `zama-skills` (kebab-case, unique — not on reserved list)
- Plugin name: `zama-skills`
- Distribution: GitHub repo (primary) + npm (fallback CLI install)

### Tooling baseline (locked from CLAUDE.md)
- Node `>=20`
- TypeScript `^5.9.3`
- npm (>=7) — no pnpm/yarn lock-in for this layer
- Validation: `zod ^3.x` for `marketplace.json` / `plugin.json` shape checks at CI time

### SKILL.md frontmatter conventions
- All 5 skills get `disable-model-invocation: true` for `/zama-deploy` only; others auto-invocable
- Use `${CLAUDE_SKILL_DIR}` for bundled asset references
- `allowed-tools` whitelist on each skill to avoid permission prompts mid-workflow
- `context: fork` on `/zama-init` (isolated subagent for noisy template scaffolding)

### Claude's Discretion
All other implementation choices (CI matrix specifics, exact SKILL.md skeleton bodies beyond frontmatter, npm CLI internals) are at Claude's discretion — pure infrastructure phase.

</decisions>

<code_context>
## Existing Code Insights

Empty repo — only `.planning/` artifacts exist (PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json, research/). No existing source code to reuse. Codebase context will be built as this phase scaffolds the foundation.

</code_context>

<specifics>
## Specific Ideas

- Reference https://code.claude.com/docs/en/plugin-marketplaces for marketplace.json schema
- Reference https://code.claude.com/docs/en/skills for SKILL.md spec
- Pin engines field to match `fhevm-hardhat-template` (`"node": ">=20"`) for downstream Layer B alignment

</specifics>

<deferred>
## Deferred Ideas

- Cursor `.cursorrules` native format export — out of scope per PROJECT.md (generic markdown only)
- Custom MCP server for Zama docs — explicitly rejected per PROJECT.md (use context7)
- Mainnet deploy automation — Sepolia only for v1

</deferred>
