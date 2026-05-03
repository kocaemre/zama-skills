# example-smoke-diff — drift policy

A CI job (`.github/workflows/example-smoke-diff.yml`) re-runs
`scripts/example-smoke-diff.mjs` on every PR + push to `main`. The script
proves that `examples/confidential-token/` is still a faithful product of the
skills shipped in this repo (EXAMPLE-05).

Without this, a maintainer could quietly hand-edit the example, the
"dogfooding" claim becomes a lie, and a later `/zama-init` run produces
something materially different from what the README demos.

## What the smoke-diff guarantees

For each "key file" of the example, one of three checks is applied:

| File                                              | Check                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/contracts/package.json`                 | Cross-check `dependencies` + `devDependencies` against `pinned-versions.json` (exact) |
| `packages/contracts/contracts/Token.sol`          | Structural invariants: license, pragma, required + forbidden imports                  |
| `packages/contracts/hardhat.config.ts`            | Structural invariants: required imports, required substrings, forbidden imports       |
| (sanity) seed → `scaffold.ts --use-case` Token.sol | Diff against the bundled seed file — catches scaffold-vs-seed decoupling regressions |

Plan 02/03 hand-curation (Next.js shell, shadcn/ui components, wagmi config,
deploy scripts, README, tests) is **explicitly excluded** from the diff —
those files are part of the example's product polish, not a faithful skill
output. The smoke-diff focuses on the load-bearing invariants where drift
would mean the skills no longer produce the example.

## Allowlist policy

`scripts/example-smoke-diff.allowlist.json` is the **single source of truth**
for what drift is acceptable:

- `patterns[]` — per-file regex strips applied to BOTH sides before
  comparison (e.g. timestamp comments, version field auto-bumps).
- `structural_invariants{}` — license / pragma / required / forbidden
  imports per file.
- `pinned_version_check` — the contracts package.json must declare exactly
  the version pinned in `pinned-versions.json`. The `aliases` map handles
  the dual-version policy for `@zama-fhe/relayer-sdk` (dev variant pins to
  `0.4.1` to match `@fhevm/hardhat-plugin@0.4.2`'s exact peer; frontend pins
  to `^0.4.2`).

### How to widen the allowlist (PR + reviewer sign-off)

If CI fails because of intentional drift, **you have two options**:

1. **Re-run the skills and commit the fresh output** (preferred). This keeps
   the example aligned with what `/zama-init` produces today.

   ```bash
   # Backup the example, re-scaffold from current skills, copy back the
   # hand-curated frontend files (Plan 02/03), commit.
   ```

2. **Widen the allowlist with explicit justification.** Add a new pattern,
   structural invariant, or alias entry, and include a `reason` field. The
   PR reviewer must sign off on widening — the entire point of the
   smoke-diff is to surface drift, not to silently accept it.

   Example:

   ```json
   {
     "file": "packages/contracts/hardhat.config.ts",
     "regex": "^// New comment we now emit at: .+$",
     "reason": "Plan XX-YY adds a per-network checksum comment; harmless drift."
   }
   ```

### How to regenerate the example when the skills intentionally change

If a skill bump changes Token.sol shape, hardhat.config networks, or pinned
versions:

1. Land the skill change (and its `pinned-versions.json` bump) in a separate
   PR first.
2. In a follow-up PR, re-run Plan 01 (`/zama-init` end-to-end) into a fresh
   branch, copy the output into `examples/confidential-token/`, re-apply
   Plan 02/03's hand-curation, and `node scripts/example-smoke-diff.mjs`
   should go green automatically.

## Local development

```bash
# Run the unit tests (synthetic fixtures).
pnpm vitest run scripts/example-smoke-diff.test.mjs

# Run the full smoke-diff against the committed example.
node scripts/example-smoke-diff.mjs
# Exit 0 = no drift. Exit 1 = drift detected (with unified diff in stderr).

# Skip the scaffold-vs-seed sanity step (faster, no /tmp scaffold cost):
SMOKE_DIFF_SKIP_SCAFFOLD=1 node scripts/example-smoke-diff.mjs
```

## Why not a verbatim file-by-file diff?

The plan originally framed the smoke-diff as "re-scaffold via skill scripts
in /tmp, diff every key file." That is technically correct but practically
fragile:

- The contract / frontend skill scripts (`generate.ts`) do not yet accept a
  `--inputs '{...}'` JSON CLI flag — the plan assumed they did. Threading
  one through is a Plan 03 refactor.
- The committed `Token.sol` is **deliberately customized** by Plan 02 to be
  a faucet-style ERC7984 (not the wrapper-style seed shipped with
  `confidential-token`). A line-by-line diff would always be red, and a
  line-stripping allowlist large enough to cover the difference would be
  noise.

The structural-invariant + pinned-version-cross-check approach catches the
**meaningful** drift modes (deprecated import sneaks in, version pin gets
bumped without updating the example, contract loses required imports) while
tolerating intentional polish.

The optional `scaffold.ts --use-case confidential-token` sanity diff still
exercises the skill's runtime end-to-end against the seed file it ships, so
seed-vs-runtime decoupling remains caught.
