---
phase: 06
plan: 06-06-clean-vm-and-submission
subsystem: distribution
tags: [smoke-test, submission, bounty, dist-06, dist-07]
requires:
  - 06-04-npm-package (zama-skills published to npm so `npx zama-skills@latest` resolves)
  - 06-05-public-and-marketplace-test (repo public + marketplace verified)
provides:
  - clean-VM smoke harness (bash) — exercises the published package end-to-end
  - pre-submission checklist with form fields + final actions
affects:
  - bounty submission readiness gate
tech-stack:
  added: []
  patterns:
    - bash smoke script using mktemp + trap cleanup + colorized assertions
    - pre-submission checklist enumerates requirement IDs + live artifact URLs
key-files:
  created:
    - scripts/clean-vm-test.sh (executable bash smoke harness, 133 lines)
    - docs/SUBMISSION-CHECKLIST.md (pre-flight + form fields + final actions, 115 lines)
  modified: []
decisions:
  - "Smoke script targets the published npm package (`npx zama-skills@latest`) rather than a local copy — judges will install the published artifact, so the smoke must exercise the same path."
  - "PLUGIN-03 spot check (`grep disable-model-invocation: true` in deploy/SKILL.md) baked into the smoke to catch publish steps that strip frontmatter."
  - "Marketplace install is documented but not auto-invoked — Claude Code slash commands cannot run from bash; user must execute `/plugin marketplace add` interactively (06-05 covers verification)."
  - "Submission form URL left as `<BOUNTY_FORM_URL>` placeholder — Zama bounty form URL is owned by the user and varies per cohort."
  - "Submission record section appended as a fillable template at the bottom of SUBMISSION-CHECKLIST.md to capture timestamp + ID after the user submits (DIST-07 audit trail)."
metrics:
  duration: 102s
  tasks: 2 (auto) + 1 (deferred checkpoint:human-action)
  files: 2 created
  completed: 2026-05-04
---

# Phase 06 Plan 06-06: Clean-VM Smoke + Submission Checklist Summary

Clean-VM smoke harness (`scripts/clean-vm-test.sh`) installs the published `zama-skills` npm package into a fresh `mktemp` workspace and asserts all 5 SKILL.md bundles plus the PLUGIN-03 model-invocation gate survive the publish round-trip; submission checklist (`docs/SUBMISSION-CHECKLIST.md`) enumerates every pre-flight item, the bounty form field values, and the tag/release/submit sequence.

## What was built

### `scripts/clean-vm-test.sh`

- `set -euo pipefail`, color helpers, `--keep` and `--with-marketplace` flags.
- Dependency check (`npx`, `node`) — exits 2 if missing.
- `mktemp -d -t zama-skills-smoke-XXXXXX` workspace; `trap` cleans up on exit unless `--keep`.
- Runs `npx --yes zama-skills@latest install --scope project --force`.
- Asserts:
  - `.claude/skills/zama-skills/` directory exists
  - All 5 `SKILL.md` files: `init/`, `contract/`, `test/`, `deploy/`, `frontend/`
  - `disable-model-invocation: true` preserved in `deploy/SKILL.md` (PLUGIN-03)
- Prints elapsed seconds for both the `npx install` step and the total run.
- Exit 0 on success, 1 on assertion failure, 2 on missing dependency.

### `docs/SUBMISSION-CHECKLIST.md`

- **Pre-submission verification** sections: repository & package, smoke & marketplace, live artifacts (Etherscan + Vercel), docs & supporting files.
- **Requirement traceability** — checkbox per requirement group (PLUGIN/SHARED/INIT/CONTRACT/TEST/DEPLOY/FRONTEND/EXAMPLE/DIST) tied back to `.planning/REQUIREMENTS.md`.
- **Submission form fields** table pre-filled with GitHub URL, npm URL, demo URL, live contract, category, short pitch (≤280 chars), long description pointer.
- **Final actions** — tag `v0.1.0`, push tag, `gh release create`, submit form at `<BOUNTY_FORM_URL>`, append `## Submission record` block.
- **Post-submission** — watch issues + npm page; freeze breaking changes during jury review.
- **Submission record** — fillable template at the bottom (timestamp / ID / notes).

## Tasks completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Clean-VM smoke harness | `83487fb` | `scripts/clean-vm-test.sh` |
| 2 | Submission checklist | `5e8bfe7` | `docs/SUBMISSION-CHECKLIST.md` |
| 3 | User runs smoke + submits bounty form | _deferred — `checkpoint:human-action`_ | n/a |

## Deferred / user-action items

Task 3 (`checkpoint:human-action`) cannot be auto-executed:

- Requires `npx zama-skills@latest` to resolve → depends on 06-04 npm publish completion (also a user action).
- Requires interactive Claude Code `/plugin marketplace add` (cannot be invoked from bash).
- Requires the user to fill and submit the bounty form (Zama-owned URL).
- Requires `git tag v0.1.0` + `git push origin v0.1.0` + `gh release create` (release-cutting authority belongs to the user).

Once the user runs `bash scripts/clean-vm-test.sh` and submits, they should append the timestamp + submission ID to the `## Submission record` block in `docs/SUBMISSION-CHECKLIST.md`.

## Deviations from Plan

None — plan executed exactly as written. Task 3 is a `checkpoint:human-action` by design; per parallel-execution constraints I committed Task 1 + Task 2 + this SUMMARY without auto-resolving the human checkpoint.

## Verification

- `test -x scripts/clean-vm-test.sh` → executable
- `bash -n scripts/clean-vm-test.sh` → syntactically valid
- `grep 'npx --yes zama-skills@latest install' scripts/clean-vm-test.sh` → present
- `grep 'disable-model-invocation: true' scripts/clean-vm-test.sh` → present
- `docs/SUBMISSION-CHECKLIST.md` 115 lines, contains `kocaemre/zama-skills`, `2026-05-09`, `clean-vm-test.sh`, `<BOUNTY_FORM_URL>`, contract address.

## Requirements

- **DIST-06** — clean-VM smoke harness shipped; flagged as **partial** until user runs against the published package and the run exits 0.
- **DIST-07** — submission checklist + timing target (2026-05-09) shipped; flagged as **partial** until the user actually submits and appends the submission record.

Both requirements transition to **complete** when the user executes the human-action checkpoint (Task 3).

## Self-Check: PASSED

- `scripts/clean-vm-test.sh` exists ✓
- `docs/SUBMISSION-CHECKLIST.md` exists ✓
- Commit `83487fb` exists ✓
- Commit `5e8bfe7` exists ✓
