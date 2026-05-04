---
phase: 06-distribution-submission
plan: 01
subsystem: docs
tags: [readme, marketing, badges, demo-gif, judge-experience]

requires:
  - phase: 05-reference-example-dapp
    provides: live Sepolia contract address + Vercel URL embedded in hero badges
provides:
  - Rewritten README hero with 30-second value prop, install one-liner, 4 live badges, 5-row skills table, demo GIF placeholder, Links section
  - docs/demo-gif-capture.md with concrete capture procedure (60–90s GIF, gifsicle optimization, MP4/YouTube fallback)
  - All `<owner>` placeholders replaced with `kocaemre`
affects: [06-02-publishing, 06-04-submission, 06-06-final-polish]

tech-stack:
  added: []
  patterns:
    - "<!-- @sync:demo-gif --> marker pattern for syncable assets"
    - "Badge row: CI · npm · Sepolia Verified · Vercel Live (left-to-right priority order)"

key-files:
  created:
    - docs/demo-gif-capture.md
  modified:
    - README.md

key-decisions:
  - "Drop https:// from /plugin marketplace add line per Claude marketplace docs convention"
  - "Skills table 'When it runs' column now uses observable trigger phrases pulled from each SKILL.md `when_to_use`"
  - "Demo GIF placeholder uses image reference at examples/confidential-token/docs/demo.gif so user can drop file in without editing README"
  - "Phase 1–5 status flipped from Pending/Active to Done in roadmap table (reflects current state)"

patterns-established:
  - "Hero structure: tagline → badges → install → demo → skills table → try-it-live → why → compatibility"
  - "Forward-reference link to THIRD_PARTY_LICENSES.md (file lands in 06-03)"

requirements-completed: [DIST-01]

duration: 8min
completed: 2026-05-04
---

# Phase 06 Plan 01: README Hero Rewrite Summary

**Judge-facing README hero with install one-liner, four live badges (CI/npm/Sepolia/Vercel), 5-row skills table, demo GIF placeholder marker, and `kocaemre` owner everywhere.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-05-04
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 rewritten)

## Accomplishments

- README hero now answers "what / install / live / skills" within first viewport (~30 lines)
- Install snippet uses bare `github.com/kocaemre/zama-skills` (no `https://`) matching Claude marketplace docs
- Badge row standardized: CI status, npm version, Sepolia Verified, Vercel Live — all live/clickable
- Skills table `When it runs` column rewritten using each SKILL.md's actual `when_to_use` trigger phrases (no fabricated triggers)
- `<!-- @sync:demo-gif -->` marker added — drop GIF at fixed path, no README edit needed
- Capture instructions doc gives maintainer a complete recording recipe with timing checkpoints, gifsicle one-liner, and MP4/YouTube fallback

## Task Commits

1. **Task 1: Rewrite README hero + replace owner placeholders** — `c68cf1d` (docs)
2. **Task 2: Write demo GIF capture instructions** — `ba9d7cf` (docs)

## Files Created/Modified

- `README.md` — Hero rewritten (tagline, badges, install, demo block, skills table, Links section); Roadmap status updated (1–5 → Done); `<owner>` → `kocaemre` everywhere
- `docs/demo-gif-capture.md` — New file with goal, tool recommendations per OS, timing script, output path, gifsicle optimization, MP4/YouTube alternative

## Decisions Made

- **Drop `https://` from marketplace command** — Claude Code marketplace docs use the bare `github.com/...` form
- **Use forward reference to `THIRD_PARTY_LICENSES.md`** even though plan 06-03 hasn't created it yet — link will resolve once that plan lands
- **Move `Try it live` paragraph below skills table** — judge wants to see install + capabilities first; deep dive into example dapp comes after

## Deviations from Plan

None — plan executed exactly as written. Both tasks' automated verifications passed first-try (`grep -c '<owner>' = 0`, all marker checks ok).

## Issues Encountered

None.

## User Setup Required

None for this plan. The demo GIF itself is a deferred manual step documented in `docs/demo-gif-capture.md` — user records and drops file at `examples/confidential-token/docs/demo.gif` whenever they're ready; no README edit needed thanks to the `@sync:demo-gif` marker.

## Next Phase Readiness

- DIST-01 (judge-ready hero) satisfied
- Forward link to `THIRD_PARTY_LICENSES.md` waits on plan 06-03
- npm version badge will go live (resolve from "package not found" placeholder shield) when plan 06-02 publishes
- Demo GIF capture is a maintainer-action item; doesn't block any other plan

## Self-Check: PASSED

- README.md exists and contains `kocaemre/zama-skills`, `/plugin marketplace add github.com/kocaemre/zama-skills`, `@sync:demo-gif`, `docs/demo-gif-capture.md`
- docs/demo-gif-capture.md exists and contains `gifsicle`, `examples/confidential-token/docs/demo.gif`
- Commits c68cf1d and ba9d7cf both present in `git log`

---
*Phase: 06-distribution-submission*
*Plan: 01-readme-hero*
*Completed: 2026-05-04*
