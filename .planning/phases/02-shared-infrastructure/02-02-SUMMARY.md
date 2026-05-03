---
phase: 02-shared-infrastructure
plan: 02
subsystem: shared-content
tags: [skills, content, context7, deprecation, decryption]
requires:
  - "Phase 1 plugin layout (plugins/zama-skills/shared/ directory exists)"
provides:
  - "Canonical context7-query block at shared/context7-query.md"
  - "4 reusable snippets: versions-table, deprecation-guard, acl-tip, sepolia-faucet"
  - "3 prompt fragments: anti-deprecation, decryption-paths, closing-summary"
affects:
  - "Plan 02-03 (build script reads these as sync sources)"
  - "Plan 02-04 (SKILL.md files transclude these via @sync markers)"
tech-stack:
  patterns:
    - "Markdown transclusion source files (no markers — they ARE the sources)"
    - "Placeholder tokens in closing-summary.md ({{SKILL_NAME}}, {{INSTALLED_FILES}}, {{NOT_DONE_LIST}}, {{NEXT_SKILL}}, {{NEXT_SKILL_REASON}})"
    - "Pin-marker placeholders in versions-table.md (`<!-- @pin:<pkg> -->`) resolved at sync time from pinned-versions.json"
key-files:
  created:
    - "plugins/zama-skills/shared/context7-query.md"
    - "plugins/zama-skills/shared/snippets/versions-table.md"
    - "plugins/zama-skills/shared/snippets/deprecation-guard.md"
    - "plugins/zama-skills/shared/snippets/acl-tip.md"
    - "plugins/zama-skills/shared/snippets/sepolia-faucet.md"
    - "plugins/zama-skills/shared/prompts/anti-deprecation.md"
    - "plugins/zama-skills/shared/prompts/decryption-paths.md"
    - "plugins/zama-skills/shared/prompts/closing-summary.md"
decisions:
  - "versions-table.md ships with `<!-- @pin:<pkg> -->` placeholder markers rather than literal version numbers — version pinning is plan 02-01's pinned-versions.json + plan 02-03's build script substitution job; this preserves single-source-of-truth"
  - "closing-summary.md transcludes versions-table + sepolia-faucet via nested @sync:snippet markers — the build script must support nested resolution (flagged for plan 02-03)"
metrics:
  duration: "~10 min"
  completed: "2026-05-03"
  tasks: "2/2"
  files: "8 created"
---

# Phase 2 Plan 02-02: Shared Content Summary

Authored 8 transclusion-source markdown files (1 top-level + 4 snippets + 3 prompts) under `plugins/zama-skills/shared/`. All canonical content (context7 source IDs, deprecation list, ACL guidance, Sepolia URLs, decryption decision tree) is now centralized for `pnpm sync` to fan out into the 5 SKILL.md files in plan 02-04.

## Files Added

| File | Purpose |
|------|---------|
| `shared/context7-query.md` | Required context7 invocation order (fhevm → hardhat-template → OZ confidential), hard refusal rules, source reputation table |
| `shared/snippets/versions-table.md` | Markdown table with `<!-- @pin:<pkg> -->` markers for every Zama-stack package + Node engine row + deprecated/incompatible sub-tables |
| `shared/snippets/deprecation-guard.md` | Refusal contract for fhevmjs + fhevm; incompatibility table for hardhat@3 + ethers@5 |
| `shared/snippets/acl-tip.md` | FHE.allowThis / FHE.allow rule of thumb; flags 0.11.x ACL API change |
| `shared/snippets/sepolia-faucet.md` | URL-only block: live address registry URL, 3 faucet URLs, RPC env-var pattern, relayer-URL guidance |
| `shared/prompts/anti-deprecation.md` | Imperative agent instructions: consult deprecated-imports.json before any import emit; cross-refs deprecation-guard.md |
| `shared/prompts/decryption-paths.md` | Decision tree for publicDecrypt / userDecrypt / requestDecryption with default-refuse rule |
| `shared/prompts/closing-summary.md` | Skill-end report template with 5 documented placeholder tokens |

## Content Sources Cited

- `/zama-ai/fhevm` (HIGH reputation, 1772 snippets) — referenced in context7-query.md, acl-tip.md, sepolia-faucet.md, decryption-paths.md
- `/zama-ai/fhevm-hardhat-template` — referenced in context7-query.md
- `/websites/openzeppelin_confidential-contracts` — referenced in context7-query.md
- `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` — referenced in sepolia-faucet.md (live-fetch only, never pinned)
- CLAUDE.md sections "Technology Stack", "What NOT to Use", "Version Compatibility" — content authority for deprecations + version notes
- npm registry verification 2026-05-03 — cited as the basis for "JSON wins over docs" rule in context7-query.md

## Cross-File References Introduced

| From | To | Mechanism |
|------|-----|-----------|
| `prompts/anti-deprecation.md` | `shared/deprecated-imports.json` (plan 02-01) | Path reference in prose |
| `prompts/anti-deprecation.md` | `snippets/deprecation-guard.md` | Cross-reference link |
| `prompts/closing-summary.md` | `snippets/versions-table.md` | Nested `@sync:snippet:versions-table` marker |
| `prompts/closing-summary.md` | `snippets/sepolia-faucet.md` | Nested `@sync:snippet:sepolia-faucet` marker |
| `snippets/versions-table.md` | `shared/pinned-versions.json` (plan 02-01) | `<!-- @pin:<pkg> -->` marker syntax |

## Placeholders Introduced (closing-summary.md)

- `{{SKILL_NAME}}` — slash-command name of running skill
- `{{INSTALLED_FILES}}` — bulleted file list created/modified
- `{{NOT_DONE_LIST}}` — explicit deferred actions
- `{{NEXT_SKILL}}` — next recommended slash command
- `{{NEXT_SKILL_REASON}}` — one-line rationale

## Verification Results

- All 8 files exist (`test -f` checks passed)
- `grep -REn '0x[a-fA-F0-9]{40}' plugins/zama-skills/shared/` → **no matches** (no pinned addresses)
- `grep -q "fhevmjs"` in deprecation-guard.md → matches (refusal context only)
- `grep -q "/zama-ai/fhevm"` in context7-query.md → matches
- `grep -q "publicDecrypt|userDecrypt|requestDecryption"` in decryption-paths.md → all three matched
- `grep -q "deprecated-imports.json"` in anti-deprecation.md → matches
- All files level-1 headed and self-contained

## Deviations from Plan

None. Plan executed exactly as written. The versions-table.md decision (use `<!-- @pin:<pkg> -->` placeholders rather than literal versions) follows the plan's plan-level guidance ("versions-table.md should NOT include version numbers — those come from pinned-versions.json at sync time").

## Commits

- `637d30f` — feat(02-02): add canonical context7-query and 4 snippet sources
- `6edce69` — feat(02-02): add 3 prompt fragments for SKILL.md transclusion

## Self-Check: PASSED

All 8 files exist on disk; both commits present in `git log`.
