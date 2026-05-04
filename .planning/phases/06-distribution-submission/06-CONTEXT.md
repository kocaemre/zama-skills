---
phase: 6
name: Distribution + Submission
gathered: 2026-05-04
status: Ready for planning
mode: Interactive discuss (3 batched questions, fast-track)
---

# Phase 6: Distribution + Submission — Context

<domain>
## Phase Boundary

Submission is live on npm + GitHub marketplace ≥24h before 2026-05-10 deadline. README sells the differentiator in 30 seconds. Fresh-VM install verified by author.

**Requirements (locked):**
- PLUGIN-05: `npx zama-skills install` alternative install path
- DIST-01: README hero (30s value prop, install snippet, 90sn demo GIF, skills table, live URLs)
- DIST-02: Generic markdown rehberler — `generic/*.md` auto-generated from each SKILL.md
- DIST-03: THIRD_PARTY_LICENSES.md (fhEVM, OZ Confidential, FHE.js)
- DIST-04: `npm publish zama-skills`
- DIST-05: GitHub repo public + `/plugin marketplace add` URL test
- DIST-06: Clean-VM end-to-end test (zero install → first dApp deploy)
- DIST-07: Submission ≥24h early (target 2026-05-09)

**Out of scope:** v2 features (audit/debug skills), Cursor `.cursorrules` native format, multi-language docs.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### Delegation Split
- **I (Claude) do:** DIST-01 (README polish), DIST-02 (generic/*.md), DIST-03 (LICENSES), DIST-04 prep (package.json + npx CLI), DIST-05 partial (repo public), DIST-06 prep (clean-VM script), DIST-07 prep (submission checklist).
- **User does:** `npm publish` (npm login interactive), clean-VM test execution, bounty submission form fill.

### Demo GIF
**Placeholder + capture instructions** in README. User captures + commits later. README `<!-- TODO: 90s demo GIF -->` marker present.

### Submission Timing
**Tech work + submit TODAY (2026-05-04)** — 6 days before deadline. Zero buffer for re-submit. Fast-track mode.

### Repo Visibility
**Public** — autonomous decision because user opted-in. `gh repo edit kocaemre/zama-skills --visibility public` runs in DIST-05.

### Generic Markdown Generator
Build a `scripts/generate-generic-docs.mjs` that reads each `plugins/zama-skills/skills/<name>/SKILL.md` and outputs `generic/<name>.md` with:
- Source skill SHA in frontmatter (for drift detection)
- Stripped Claude-specific syntax (allowed-tools, ${CLAUDE_SKILL_DIR}) replaced with generic equivalents
- Pointer back to canonical SKILL.md
CI smoke-diff: re-run generator, fail if generic/*.md differs from committed.

### npx CLI
`bin/install.mjs` (commander + prompts + fs-extra) → asks scope (personal `~/.claude/skills/` vs project `.claude/skills/`), copies skill bundles, prints next steps. Exit 0.

### Licenses Audit
Tools: pnpm-license-list or manual curation from `package.json` deps:
- fhEVM `@fhevm/solidity` (BSD-3-Clause-Clear)
- @openzeppelin/confidential-contracts (MIT)
- @zama-fhe/relayer-sdk (BSD-3-Clause-Clear)
- ethers (MIT), wagmi (MIT), viem (MIT)
- Next.js (MIT), shadcn (MIT), RainbowKit (MIT)
Compile into `THIRD_PARTY_LICENSES.md` with version + license + copyright holder.
</decisions>

<code_context>
## Existing Code

- 5 SKILL.md files (Phases 1, 3, 4) — auth source for generic/*.md
- `examples/confidential-token/` (Phase 5) — referenced in README hero
- `scripts/validate.ts` (Phase 4) — ci validation harness
- `scripts/example-smoke-diff.mjs` (Phase 5) — pattern to copy for generic-docs smoke-diff
- `package.json` (root) — needs `bin`, `files`, `exports` for npm publish
- GitHub Actions: `.github/workflows/{ci.yml,example-smoke-diff.yml}` — add LICENSE check + generic-docs drift check

## Patterns to Reuse

- TDD gate (RED test → GREEN impl) for all script work
- Sync markers for cross-file substitutions (already in 05-05 pattern)
- Worktree-isolated parallel execution where files don't overlap
</code_context>

<canonical_refs>
- .planning/PROJECT.md (constraints, deadline)
- .planning/REQUIREMENTS.md (DIST-* + PLUGIN-05)
- .planning/ROADMAP.md (Phase 6 success criteria)
- plugins/zama-skills/skills/*/SKILL.md (5 files — source for generic/*.md)
- plugins/zama-skills/.claude-plugin/plugin.json + marketplace.json
- examples/confidential-token/README.md (Phase 5 hero — link from root)
- README.md (root — needs hero rewrite)
- https://docs.npmjs.com/cli/v10/commands/npm-publish
- https://code.claude.com/docs/en/plugin-marketplaces (marketplace.json schema)
</canonical_refs>

<specifics>
- README hero MUST show: 30s value prop, single-line install (`/plugin marketplace add github.com/kocaemre/zama-skills`), 5-row skills table, live Sepolia + Vercel badges (already present from Phase 5), GIF placeholder, links to docs/contributing.
- npm package name: `zama-skills` (verify availability with `npm view`).
- License: MIT (or whatever is in package.json — check).
- Submission form URL: TBD (user has it).
</specifics>

<deferred>
- v2 audit/debug skills (out of scope this milestone)
- Cursor native format
- Demo video re-takes / polish
- Multi-language docs
- Brand colors / logo design
</deferred>
