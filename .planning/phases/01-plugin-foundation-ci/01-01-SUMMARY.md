---
phase: 01-plugin-foundation-ci
plan: 01
title: Marketplace + Plugin Manifest
subsystem: plugin-foundation
tags: [marketplace, plugin-manifest, license, gitignore]
requires: []
provides:
  - claude-code-marketplace-entry
  - plugin-manifest
  - mit-license
  - node-gitignore
affects:
  - .claude-plugin/marketplace.json
  - plugins/zama-skills/.claude-plugin/plugin.json
  - LICENSE
  - .gitignore
key-files:
  created:
    - .claude-plugin/marketplace.json
    - plugins/zama-skills/.claude-plugin/plugin.json
    - LICENSE
    - .gitignore
  modified: []
decisions:
  - "Omit `version` field on both manifest files during dev (commit SHA = version)"
  - "Keep `<owner>` placeholder literal in homepage/repository URLs; replaced in Phase 6"
  - "`.claude-plugin/` directories contain only their respective JSON manifest — skills/ live at plugin root, not nested"
metrics:
  duration: ~3 min
  completed: 2026-05-03
  tasks_total: 3
  tasks_completed: 3
---

# Phase 1 Plan 01: Marketplace + Plugin Manifest Summary

Marketplace catalog and plugin manifest scaffolded at the canonical Claude Code paths so the GitHub repo is addressable via `/plugin marketplace add` once pushed. MIT LICENSE + Node `.gitignore` complete the repo-root foundation other Wave-1 plans depend on.

## What Was Built

| Task | File | Purpose | Commit |
|------|------|---------|--------|
| 1 | `.claude-plugin/marketplace.json` | Marketplace catalog with single plugin entry pointing to `./plugins/zama-skills` | `0ba19d1` |
| 2 | `plugins/zama-skills/.claude-plugin/plugin.json` | Plugin manifest (name, author, license, keywords) | `697e9be` |
| 3 | `LICENSE`, `.gitignore` | MIT license (2026 Emre Koca) + standard Node ignores | `180e901` |

## Success Criteria Results

- [x] Both manifests parse as JSON (verified via `node -e "require(...)"`)
- [x] `marketplace.name === "zama-skills"` and `plugins[0].name === "zama-skills"`
- [x] `plugins[0].source === "./plugins/zama-skills"` (leading `./`, no `..`)
- [x] No `version` field on either manifest (dev policy)
- [x] `.claude-plugin/` directories contain ONLY their respective JSON file (no `skills/` subdir contamination)
- [x] LICENSE has `MIT License` header with year `2026` and name `Emre Koca`
- [x] `.gitignore` covers `node_modules/`, `dist/`, `.env`, `.DS_Store`
- [x] Ready for PLAN-02 to populate `plugins/zama-skills/skills/`

## Verification Block

```bash
$ node -e "
  const m = require('./.claude-plugin/marketplace.json');
  const p = require('./plugins/zama-skills/.claude-plugin/plugin.json');
  console.assert(m.name === 'zama-skills', 'marketplace.name');
  console.assert(m.plugins[0].name === 'zama-skills', 'plugin entry name');
  console.assert(m.plugins[0].source === './plugins/zama-skills', 'source path');
  console.assert(!('version' in m.plugins[0]), 'no version on entry');
  console.assert(p.name === 'zama-skills', 'plugin.name');
  console.assert(!('version' in p), 'no version on plugin');
  console.log('PLAN-01 invariants OK');
"
PLAN-01 invariants OK

$ [ "$(ls plugins/zama-skills/.claude-plugin/)" = "plugin.json" ] && echo clean
plugin .claude-plugin clean

$ [ "$(ls .claude-plugin/)" = "marketplace.json" ] && echo clean
root .claude-plugin clean
```

All assertions passed. All three per-task `<verify>` blocks also passed inline (`node -e ... ok`, `test -f LICENSE && grep -q "MIT License" LICENSE && grep -q "node_modules/" .gitignore && echo ok`).

## Deviations from Plan

None — plan executed exactly as written. All file contents match the plan's specified shapes verbatim (modulo formatting); no auto-fixes triggered, no architectural decisions required, no auth gates encountered.

## Threat Model Compliance

- **T-01-01-a (Tampering on `source`)** — mitigated: `source` is hard-coded to `./plugins/zama-skills`, leading `./` present, no `..`. Full zod validator deferred to PLAN-04 as planned.
- **T-01-01-b (Spoofing marketplace name)** — mitigated: `zama-skills` confirmed against the reserved-name list (agent-skills, claude-code-marketplace, claude-plugins-official, anthropic-marketplace, anthropic-plugins, claude-code-plugins, knowledge-work-plugins, life-sciences) — not present, safe.
- **T-01-04 (Tampering on `version`)** — mitigated: `version` field intentionally omitted from both manifests; verified via `!('version' in m.plugins[0])` and `!('version' in p)` assertions.
- **T-01-IP (LICENSE attribution)** — accept: owner email `emrekoca2003@gmail.com` matches the public `userEmail` from CLAUDE.md.

## Commits

| Hash | Type | Message |
|------|------|---------|
| `0ba19d1` | feat | add marketplace.json at repo root |
| `697e9be` | feat | add plugin.json for zama-skills plugin |
| `180e901` | chore | add MIT LICENSE and Node .gitignore |

## Self-Check: PASSED

- [x] FOUND: `.claude-plugin/marketplace.json`
- [x] FOUND: `plugins/zama-skills/.claude-plugin/plugin.json`
- [x] FOUND: `LICENSE`
- [x] FOUND: `.gitignore`
- [x] FOUND commit `0ba19d1`
- [x] FOUND commit `697e9be`
- [x] FOUND commit `180e901`
