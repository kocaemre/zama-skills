---
phase: 05-reference-example-dapp
plan: 06
subsystem: ci
tags: [ci, smoke-diff, drift-detection, example, github-actions]
requires: [05-01]
provides:
  - "EXAMPLE-05: drift detection between skills and examples/confidential-token/"
  - "scripts/example-smoke-diff.mjs (reusable diff driver)"
  - "scripts/example-smoke-diff.allowlist.json (drift policy file)"
  - ".github/workflows/example-smoke-diff.yml (CI gate)"
affects:
  - "Future skill template changes either pass smoke-diff or surface drift in PR"
  - "Maintainer hand-edits to examples/confidential-token/ that contradict pinned-versions.json fail CI"
tech-stack:
  added: []
  patterns:
    - "Structural-invariant + pinned-version-cross-check (instead of verbatim file diff)"
    - "Per-line allowlist regex stripping"
    - "Alias map for dual-version policy (@zama-fhe/relayer-sdk dev variant)"
key-files:
  created:
    - scripts/example-smoke-diff.mjs
    - scripts/example-smoke-diff.allowlist.json
    - scripts/example-smoke-diff.test.mjs
    - .github/workflows/example-smoke-diff.yml
    - .planning/phases/05-reference-example-dapp/SMOKE-DIFF.md
  modified: []
decisions:
  - "Smoke-diff uses structural invariants + pinned-version cross-check, NOT verbatim file diff. Reason: (a) committed Token.sol is intentionally customized away from the seed by Plan 02 (faucet vs ERC7984ERC20Wrapper), (b) contract/frontend skill scripts do not yet accept --inputs JSON CLI flag the plan assumed. The structural approach catches the meaningful drift modes (deprecated import sneaks in, version pin bumped without example update, contract loses required imports) while tolerating intentional polish."
  - "@zama-fhe/relayer-sdk in contracts/devDependencies pins to 0.4.1 (matches @fhevm/hardhat-plugin@0.4.2 exact peer); pinned-versions.json expresses this as a separate @zama-fhe/relayer-sdk-dev entry with aliasOf. Allowlist threads this via a pinned_version_check.aliases map."
  - "scaffold smoke step (re-run scaffold.ts --use-case confidential-token in /tmp, diff fresh Token.sol vs the seed file) ran cleanly and is gated by env SMOKE_DIFF_SKIP_SCAFFOLD=1 for fast unit-test contexts."
metrics:
  duration: "~50min"
  completed: "2026-05-03T21:08:24Z"
  tasks: 2
  commits: 2
  files_created: 5
---

# Phase 05 Plan 06: CI Smoke-Diff Summary

GitHub Actions job `example-smoke-diff` that re-runs unit tests on the diff
driver and proves `examples/confidential-token/` has not silently drifted from
the canonical output of the skills shipped in this repo.

## What shipped

| Artifact                                          | Purpose                                                       |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `scripts/example-smoke-diff.mjs`                  | Diff driver (validateAllowlist, structural invariants, pinned-version cross-check, optional scaffold-vs-seed sanity step) |
| `scripts/example-smoke-diff.allowlist.json`       | Single source of truth for acceptable drift                   |
| `scripts/example-smoke-diff.test.mjs`             | 20 vitest unit tests on synthetic fixtures                    |
| `.github/workflows/example-smoke-diff.yml`        | CI gate (PR + push to main, Node 20, npm ci, vitest + driver) |
| `.planning/phases/05-reference-example-dapp/SMOKE-DIFF.md` | Drift policy: when to widen allowlist, when to re-scaffold |

## Smoke-diff key file count

- **Cross-checked package.json**: 1 (`packages/contracts/package.json`, 10 packages)
- **Structural-invariant files**: 2 (`Token.sol`, `hardhat.config.ts`)
- **Allowlist patterns**: 3 (HCU comment, hardhat-config timestamp, package.json version)
- **Pinned-version cross-checks**: 10 packages
- **Scaffold-vs-seed sanity diff**: 1 file (Token.sol vs seed)

## First local run result

```
✓ example-smoke-diff: no drift detected
  - example: examples/confidential-token
  - allowlist patterns: 3
  - structural invariants: 2 file(s)
  - pinned-version cross-checks: 10 package(s)
```

Exit code 0. Vitest: 20/20 passing.

## Drift surfaced + resolution

**1. `@zama-fhe/relayer-sdk` version mismatch (resolved during Task 1).**

Initial run flagged: `example has "0.4.1", pinned-versions.json has "^0.4.2"`.
Investigation showed pinned-versions.json deliberately maintains TWO entries:

- `@zama-fhe/relayer-sdk: ^0.4.2` (frontend dependencies — newer patch)
- `@zama-fhe/relayer-sdk-dev: 0.4.1, exact: true, aliasOf` (devDeps — exact peer of `@fhevm/hardhat-plugin@0.4.2`)

The contracts/devDependencies block correctly uses the dev variant pin. Resolved
by extending `checkPinnedVersionsSatisfied` to accept an `aliases` map, and
adding `"@zama-fhe/relayer-sdk": "@zama-fhe/relayer-sdk-dev"` to the allowlist's
`pinned_version_check.aliases`. Now passes.

## Deviations from Plan

### Deviations (Rule 1/3 — adjusted scope to be technically achievable)

**1. [Rule 3 — blocking]: Diff strategy switched from verbatim-file to structural-invariant + pinned-version cross-check.**

- **Found during:** Task 1 design.
- **Issue:** The plan's `<interfaces>` driver flow assumed (a) `generate.ts`
  for contract/frontend skills accepts `--inputs '{...}'` JSON, and (b)
  `examples/confidential-token/packages/contracts/contracts/Token.sol` is
  the verbatim seed output. Both are false: the generate.ts scripts do not
  expose --inputs CLI flags (only the init scaffold.ts does), and the
  example's Token.sol is deliberately customized by Plan 02 to be a
  faucet-style ERC7984 (not the wrapper-style seed shipped with the
  `confidential-token` use-case).
- **Fix:** Implemented the smoke-diff as structural-invariant assertions on
  Token.sol + hardhat.config.ts (license, pragma, required imports,
  forbidden imports) PLUS pinned-version cross-check on contracts/package.json
  (every dep in the example must declare the version pinned in
  pinned-versions.json). This catches the meaningful drift modes (deprecated
  fhevmjs sneaks in, version pin bumped without updating the example,
  contract loses FHE.sol import) while tolerating intentional polish. Plus
  an OPTIONAL scaffold-vs-seed sanity diff (re-runs `scaffold.ts --use-case
  confidential-token` in /tmp, diffs fresh Token.sol against the seed file)
  which exercises the init skill's runtime end-to-end.
- **Files modified:** scripts/example-smoke-diff.mjs, scripts/example-smoke-diff.allowlist.json
- **Commit:** 359ecf8

**2. [Rule 3 — blocking]: Frontend files removed from key-file diff list.**

- **Found during:** Task 1 design.
- **Issue:** Plan listed `packages/frontend/src/lib/fhe.ts`, `useDecrypted.ts`,
  `EncryptedInput.tsx` as key files. These are not generated by an
  --inputs-driven CLI we can re-invoke; they are produced by the frontend
  skill which today reads its inputs from disk/SKILL.md context, not flags.
- **Fix:** Excluded from this iteration. The structural-invariant approach
  could be extended to these files in a follow-up plan if frontend drift
  becomes a concern (no forbidden imports = `fhevmjs`, required imports =
  `@zama-fhe/relayer-sdk`). Documented in SMOKE-DIFF.md as a known scope
  limit.
- **Files modified:** scripts/example-smoke-diff.allowlist.json (does not
  declare frontend files in `structural_invariants`)
- **Commit:** 359ecf8

**3. [Rule 3]: `node:diff` swapped for in-house line diff.**

- **Found during:** Task 1 design.
- **Issue:** Plan's `<interfaces>` referenced `node:diff` — Node has no such
  builtin. The optional `diff` npm package is not in root devDependencies.
- **Fix:** Implemented a minimal symmetric line-by-line diff renderer
  (`renderLineDiff`) that emits a unified-style `+/-` block. Sufficient for
  the failure mode (the goal is to surface the drift in the job log, not
  produce a perfect patch). Zero new install burden in CI.
- **Files modified:** scripts/example-smoke-diff.mjs
- **Commit:** 359ecf8

**4. [Rule 3]: CI workflow uses `npm ci` (not `pnpm install`).**

- **Found during:** Task 2 design.
- **Issue:** Plan's example workflow used `pnpm install --frozen-lockfile`,
  but the existing `.github/workflows/ci.yml` uses `npm ci` (root package
  uses npm, not pnpm — `examples/confidential-token/` uses pnpm internally
  but the smoke-diff driver runs from repo root).
- **Fix:** Workflow uses `npm ci`, matching `ci.yml`. Mirrors `actions/checkout@v5`
  + `actions/setup-node@v5` versions for consistency.
- **Files modified:** .github/workflows/example-smoke-diff.yml
- **Commit:** 879cb82

## Verification

- [x] `pnpm vitest run scripts/example-smoke-diff.test.mjs` → 20/20 passing
- [x] `node scripts/example-smoke-diff.mjs` → exit 0, no drift
- [x] `.github/workflows/example-smoke-diff.yml` exists and contains `example-smoke-diff` name
- [x] Allowlist `comment` field is unambiguous about widening policy
- [x] SMOKE-DIFF.md committed and documents widen / regenerate flows

## Self-Check

```
[ -f scripts/example-smoke-diff.mjs ] → FOUND
[ -f scripts/example-smoke-diff.allowlist.json ] → FOUND
[ -f scripts/example-smoke-diff.test.mjs ] → FOUND
[ -f .github/workflows/example-smoke-diff.yml ] → FOUND
[ -f .planning/phases/05-reference-example-dapp/SMOKE-DIFF.md ] → FOUND
git log 359ecf8 → FOUND
git log 879cb82 → FOUND
```

## Self-Check: PASSED

## Commits

| Hash      | Message                                          |
| --------- | ------------------------------------------------ |
| `359ecf8` | feat(05-06): smoke-diff driver + allowlist + tests |
| `879cb82` | ci(05-06): example-smoke-diff workflow           |
