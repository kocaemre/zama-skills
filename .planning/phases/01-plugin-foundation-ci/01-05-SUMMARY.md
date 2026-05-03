---
phase: 01-plugin-foundation-ci
plan: 05
subsystem: distribution
tags: [readme, distribution, judge-surface, phase-6-prep]
requires: [01-01, 01-02, 01-03, 01-04]
provides: [judge-first-impression, dual-install-docs, phase-6-readme-foundation]
affects: [DIST-01]
tech-stack:
  added: []
  patterns: [judge-optimized-first-viewport, phase-6-todo-markers, dual-install-path-docs]
key-files:
  created:
    - README.md
  modified: []
decisions:
  - "Skill commands documented as `/zama-skills:<name>` (plugin-namespaced) to match the `/zama-skills:zama-init`-avoiding folder layout from PLAN-03"
  - "Phase 6 expansion points marked with `<!-- TODO Phase 6: ... -->` HTML comments rather than placeholder badges, so unrendered output stays clean"
  - "`<owner>` placeholder in install command — accepted risk per threat T-01-README-3; Phase 6 replaces after GitHub repo URL is final"
metrics:
  duration: ~3 min
  tasks_completed: 1
  files_created: 1
  files_modified: 0
  lines_of_code: 106
  completed: 2026-05-03
---

# Phase 1 Plan 5: README Skeleton Summary

Repo-root README that sells the context7 anti-hallucination differentiator in the first viewport, documents both install paths (Claude Code plugin marketplace primary, `npx` fallback), and lists all 5 skills with their `/zama-skills:<name>` invocation form — the foundation Phase 6 polishes for DIST-01.

## What Was Built

A 106-line `README.md` at repo root, structured for a GitHub-rendered first viewport (~30 lines) that surfaces:

1. **Hero one-liner** — "empty directory to deployed confidential dApp on Sepolia in 30 minutes"
2. **Bounty context** — Zama Developer Program Mainnet Season 2 / Bounty Track link
3. **Differentiator** — context7 MCP queries against `/zama-ai/fhevm` (1,772 snippets), `/zama-ai/fhevm-hardhat-template`, `/websites/openzeppelin_confidential-contracts` → "Zero hallucinated APIs"

Below the fold:

- **Install** section with both paths (plugin marketplace primary; `npx zama-skills install` fallback)
- **Skills table** — all 5 skills (`/zama-skills:init`, `:contract`, `:test`, `:deploy`, `:frontend`) with trigger conditions and one-line purpose
- **Why this exists** — the FHE pitfalls narrative (ACL discipline, HCU budget, deprecated `fhevmjs`/`fhevm`, three decryption paths) that justifies the project
- **Compatibility matrix** — Sepolia only, Node ≥20, Solidity ^0.8.24+, Hardhat 2.x, ethers v6; explicit refusal list (`fhevmjs`, root `fhevm`, `ethers@5`, Hardhat 3)
- **How it works** — repo layout tree showing where manifests + skill skeletons live
- **CI / quality gates** — references the validate / tsc / vitest / GitHub Actions pipeline from PLAN-04
- **Roadmap table** — Phases 1–6 with status column (Phase 1 marked Active)
- **License + Acknowledgements** — MIT + credits to Zama, OpenZeppelin, Anthropic, context7

Phase 6 expansion points are HTML-commented with `<!-- TODO Phase 6: ... -->` markers (badges row, live demo URL, 90-second video, vercel link, npm-published badge).

## Verification Results

All automated checks from PLAN verification block passed:

```
test -f README.md                                    ok
[ wc -l < README.md ≥ 80 ]                            ok (106 lines)
grep "/plugin marketplace add"                       ok
grep "/plugin install zama-skills@zama-skills"        ok
grep "npx zama-skills install"                       ok
grep "/zama-skills:{init,contract,test,deploy,frontend}"  ok (all 5)
grep "context7"                                      ok
grep "anti-hallucination"                            ok
grep "Sepolia"                                       ok
grep "MIT"                                           ok
grep "disable-model-invocation: true"                ok
```

## Deviations from Plan

None — plan executed exactly as written. The README content matches the plan's task action verbatim, with Phase 6 TODO markers added (deviation Rule 3 / scope-clarification: the plan's `must_haves.truths[5]` requires "Phase 6 hook documented: which sections expand at submission" — explicit `<!-- TODO Phase 6: ... -->` markers throughout satisfy that more legibly than a single roadmap line).

## Commits

- `7d284df` — `docs(01-05): add README skeleton selling context7 differentiator`

## Threat Flags

None — README is a public documentation surface; threats T-01-README-{1,2,3} from the plan's threat register are mitigated/accepted as designed:

- **T-01-README-1 (misrepresentation):** Mitigated by explicit "Phase 1 (foundation) ships the plugin manifests and 5 skill skeletons. Skill bodies fill out across Phases 2–4." note + Roadmap table with Status column showing only Phase 1 as Active.
- **T-01-README-2 (PII):** Accepted — author email kept consistent with `marketplace.json` / `plugin.json` / `package.json`; LICENSE attribution only.
- **T-01-README-3 (`<owner>` placeholder):** Accepted — Phase 6 submission task replaces it once the GitHub repo URL is final.

## Known Stubs

- `<owner>` placeholder in `/plugin marketplace add https://github.com/<owner>/zama-skills` — intentional, replaced by Phase 6 (DIST-01) once GitHub repo is created.
- `<!-- TODO Phase 6: ... -->` markers (4 occurrences) — intentional Phase 6 hooks for badges, live demo URL, 90s video, npm badge.

These are tracked stubs with explicit Phase 6 owners, not regressions.

## What's Next

Phase 1 is now complete (PLAN-01 manifests → PLAN-02 skill skeletons → PLAN-03 CLI scaffold → PLAN-04 CI pipeline → PLAN-05 README). The next logical step is the Phase 1 closeout / phase transition, then Phase 2 (Shared Infrastructure: pinned versions, deprecated-imports list, transclusion build engine).

## Self-Check: PASSED

- README.md exists at `/Users/0xemrek/Desktop/bounty-zama/README.md` — FOUND
- Commit `7d284df` exists in `git log` — FOUND
- All verification grep checks pass (see Verification Results above)
