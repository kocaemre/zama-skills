---
phase: 05-reference-example-dapp
plan: 05
subsystem: reference-example-dapp
tags: [docs, vercel, readme, example, dist-01, example-03]
requires: [05-01, 05-02, 05-03, 05-04]
provides: [hero-readme, vercel-bind-guide, root-readme-live-demo-section]
affects: [README.md, examples/confidential-token/]
tech-stack:
  added: []
  patterns:
    - "@sync:vercel-url HTML-comment marker for future build-hook URL fill"
    - "shields.io badges for Sepolia Verified + Vercel Live"
    - "dogfooding callout — README points at .gsd-snapshot.json so judges can verify reproducibility"
key-files:
  created:
    - examples/confidential-token/VERCEL.md
    - examples/confidential-token/docs/demo.gif.TODO
  modified:
    - examples/confidential-token/README.md
    - README.md
decisions:
  - "Used VERCEL.md at example root (not docs/vercel-setup.md per the original plan) — matches the user's task prompt; single-file top-level docs are easier for users to discover."
  - "Pre-filled NEXT_PUBLIC_CONTRACT_ADDRESS + NEXT_PUBLIC_RELAYER_URL with the live values; user only needs to add their own RPC + WalletConnect ID."
  - "Used <VERCEL_URL> as a literal placeholder string with <!-- @sync:vercel-url --> sibling comment so a Phase 6 sed/grep hook can patch all occurrences."
  - "Did not touch other root README sections; DIST-01 full hero polish is Phase 6."
metrics:
  duration: ~10 minutes
  completed: 2026-05-03
  tasks_executed: 2
  tasks_pending: 1 (checkpoint:human-action)
  files_changed: 4
---

# Phase 05 Plan 05: README and Vercel Prep Summary

Wired the bounty-submission landing experience: a hero README for the confidential-token example with the live Sepolia contract address + Etherscan badge, a copy-pasteable VERCEL.md guide for the user to bind the GitHub repo to Vercel, a 90-second GIF capture spec, and a root-README "Try it live" section that points judges at the example. All Vercel URL slots use a single `@sync:vercel-url` marker so Phase 6 can patch them in one sed pass once the user reports the production URL.

## What Changed

### Created
- **`examples/confidential-token/VERCEL.md`** (3.9 KB) — six-step bind guide with the four required `NEXT_PUBLIC_*` env vars in a copy-table, troubleshooting matrix (5 common Vercel-monorepo failure modes), and an explicit "Why Vercel binding is a manual step" rationale linking 05-CONTEXT.md.
- **`examples/confidential-token/docs/demo.gif.TODO`** (1.7 KB) — frame-by-frame 90s recording script (mint → 4-state decrypt → transfer → recipient decrypt) + tool recommendations (Kap / LICEcap / gifsicle) + commit checklist.

### Modified
- **`examples/confidential-token/README.md`** — full rewrite of the hero. Replaced the previous (and now stale) `0x1ceD…` address with the canonical `0x04Bd105DE7a5D3297c3747cef90ac8b760136896` (verified against `packages/contracts/deployments/sepolia/Token.json`). Added Sepolia Verified + Registry + Vercel badges, "Try it live" section with `@sync:vercel-url` markers, "What this proves" (EXAMPLE-01 + EXAMPLE-03), "How this was built" (six-step skill replay + `.gsd-snapshot.json` reference), local dev table with all four env vars + defaults, link to VERCEL.md.
- **`README.md`** (root) — inserted "Try it live" section between Install and "What you get" (8 lines). Vercel + Sepolia badges with `@sync:vercel-url` marker, link to `examples/confidential-token/` with one-line pitch, GIF reference. No other sections touched (DIST-01 full hero is Phase 6).

## README Structure Decisions

- **Hero first.** First viewport of `examples/confidential-token/README.md` is title + tagline + three badges + "Try it live" links — judge knows in 5 seconds whether to click through.
- **Live data, not lorem ipsum.** Pulled the canonical address from `packages/contracts/deployments/sepolia/Token.json` (per user instruction "don't hard-code"); cross-referenced with `DEPLOYED.md` for the deploy tx hash + block number.
- **Single sync marker.** Every `<VERCEL_URL>` placeholder is paired with an HTML comment `<!-- @sync:vercel-url -->` so a Phase 6 build hook (or `sed -i 's|<VERCEL_URL>|<actual>|g'`) can patch all four occurrences across two files in one pass.
- **No invented commands.** Every command in the local-dev table was verified against the existing `package.json` workspace structure (`pnpm --filter contracts`, `pnpm --filter frontend`).

## Vercel URL Fill Status

**Pending.** Vercel binding is a `checkpoint:human-action` task (Plan task 3) — the user must:
1. Push the repo to GitHub
2. Bind at vercel.com/new with Root Directory = `examples/confidential-token/packages/frontend`
3. Add the four `NEXT_PUBLIC_*` env vars (table provided in VERCEL.md)
4. Reply with the production URL (or `deferred` to push to Phase 6)

Until that reply, all `<VERCEL_URL>` markers remain as literal placeholders. EXAMPLE-03 stays "partially met" — contract live + UI scaffolded + bind-guide ready, missing only the public URL.

## GIF Capture Status

**Pending.** Placeholder file `docs/demo.gif.TODO` committed with detailed capture spec. Real GIF lands in Phase 6 polish (per the original plan: "Real GIF lands in Phase 6 polish").

## Root README Diff Size

8 lines inserted, 0 deleted. Section sits between Install and "What you get — 5 skills". No existing content modified.

## Deviations from Plan

### [Rule 3 - Naming] Used `VERCEL.md` instead of `docs/vercel-setup.md`

- **Found during:** Task 1 setup
- **Issue:** The original plan (`<interfaces>` block) named the file `docs/vercel-setup.md`. The user's executor prompt explicitly named it `examples/confidential-token/VERCEL.md` (top-level, capitalized).
- **Fix:** Followed the user prompt — top-level `VERCEL.md` is more discoverable next to `README.md` and `DEPLOYED.md`. README link target updated accordingly.
- **Files modified:** `examples/confidential-token/VERCEL.md` (instead of `docs/vercel-setup.md`)
- **Commit:** acb4da4

### [Rule 1 - Bug] Stale contract address `0x1ceD…` in pre-existing README

- **Found during:** Task 1 (reading current README)
- **Issue:** Plan 05-04's README hard-coded `0x1ceD5d54B8565Db5493b64Bca389b8132841B658`, which is from an earlier deploy. The canonical, current contract per `deployments/sepolia/Token.json` is `0x04Bd105DE7a5D3297c3747cef90ac8b760136896` (re-deployed at block 10784067).
- **Fix:** Full hero rewrite uses the canonical address everywhere. All Etherscan links, badges, and env-var defaults point at `0x04Bd…6896`.
- **Files modified:** `examples/confidential-token/README.md`, `README.md`, `examples/confidential-token/VERCEL.md`
- **Commit:** acb4da4 + d988aec

## Commits

| Task | Hash | Message |
| --- | --- | --- |
| 1 | acb4da4 | docs(05-05): hero README + VERCEL.md for confidential-token example |
| 2 | d988aec | docs(05-05): root README links to confidential-token live demo |
| 3 | — | (checkpoint:human-action — pending user) |

## Self-Check: PASSED

- [x] `examples/confidential-token/README.md` exists, contains "Try it live", "Sepolia", and `@sync:vercel-url`
- [x] `examples/confidential-token/VERCEL.md` exists, contains "vercel.com/new" and `NEXT_PUBLIC_CONTRACT_ADDRESS`
- [x] `examples/confidential-token/docs/demo.gif.TODO` exists
- [x] Root `README.md` contains "examples/confidential-token", "Try it live", and `@sync:vercel-url`
- [x] No stale `0x1ceD…` references remain in any of the three docs (verified via grep)
- [x] Canonical address `0x04Bd105DE7a5D3297c3747cef90ac8b760136896` matches `deployments/sepolia/Token.json`
- [x] Commit acb4da4 found in git log
- [x] Commit d988aec found in git log
