---
phase: 05-reference-example-dapp
plan: 01
subsystem: examples
tags: [scaffold, dogfood, erc7984, snapshot, example-01, example-04]
requires:
  - plugins/zama-skills/skills/init/scripts/scaffold.ts
  - plugins/zama-skills/skills/contract/scripts/generate.ts
  - plugins/zama-skills/skills/test/scripts/generate.ts
  - plugins/zama-skills/skills/frontend/scripts/generate.ts
  - plugins/zama-skills/shared/pinned-versions.json
provides:
  - examples/confidential-token/ (skill-produced scaffold baseline)
  - examples/confidential-token/.gsd-snapshot.json (EXAMPLE-04 provenance)
affects:
  - plugins/zama-skills/skills/init/assets/templates/root-package.json.tpl
  - plugins/zama-skills/skills/init/assets/templates/packages/contracts/package.json.tpl
  - plugins/zama-skills/skills/init/assets/templates/packages/frontend/package.json.tpl
  - plugins/zama-skills/skills/contract/assets/templates/erc7984.sol.tpl
tech-stack:
  added:
    - ts-node@^10.9.2 (contracts package, hardhat TS config loading)
    - "@types/node@^20.19.30, @types/mocha@^10.0.6, @types/chai@^4.3.16"
  patterns:
    - "ZamaEthereumConfig (replaces non-existent SepoliaConfig export in @fhevm/solidity@0.11.x)"
    - "OZ ERC7984 import path: token/ERC7984/ERC7984.sol (not token/ERC7984.sol)"
key-files:
  created:
    - examples/confidential-token/.gsd-snapshot.json
    - examples/confidential-token/scripts/snapshot.mjs
    - examples/confidential-token/pnpm-lock.yaml
    - examples/confidential-token/packages/contracts/contracts/Token.sol
    - examples/confidential-token/packages/contracts/test/Token.test.ts
    - examples/confidential-token/packages/contracts/test/Token.sepolia.test.ts
    - examples/confidential-token/packages/frontend/src/lib/fhe.ts
    - examples/confidential-token/packages/frontend/src/hooks/useDecrypted.ts
    - examples/confidential-token/packages/frontend/src/components/EncryptedInput.tsx
  modified:
    - plugins/zama-skills/skills/init/assets/templates/{root,packages/{contracts,frontend}}/package.json.tpl
    - plugins/zama-skills/skills/contract/assets/templates/erc7984.sol.tpl
decisions:
  - "Test files use .test.ts naming (per skill output) — plan frontmatter listed .spec.ts; skill output is canonical (per task CRITICAL note)"
  - "Surfaced skill bugs auto-fixed in skill templates (Rule 3 blocking-issue), then scaffold regenerated. EXAMPLE-01 still satisfied because all output is skill-produced."
  - "ZamaEthereumConfig replaces SepoliaConfig in must_haves.truths (the latter export does not exist in @fhevm/solidity@0.11.1)"
metrics:
  duration: ~25 min
  completed: 2026-05-03
---

# Phase 05 Plan 01: Scaffold Examples from Skills — Summary

Dogfooded the four primary skills (`/zama-init`, `/zama-contract`, `/zama-test`, `/zama-frontend`) into a fresh `examples/confidential-token/` workspace, surfacing three skill template bugs along the way and capturing provenance in `.gsd-snapshot.json`.

## Skill Invocations (in order)

| # | Skill | Script | Inputs | Output |
|---|---|---|---|---|
| 1 | `/zama-init` | `plugins/zama-skills/skills/init/scripts/scaffold.ts` | `--use-case confidential-token --target examples/confidential-token` | monorepo skeleton (15 files) + `Token.sol` seed + `register-token.ts` |
| 2 | `/zama-contract` | `plugins/zama-skills/skills/contract/scripts/generate.ts` | `{name:"Token", base:"erc7984", schema:[], decryptionPath:"user"}` | regenerated `Token.sol` (ERC7984 + ZamaEthereumConfig) |
| 3 | `/zama-test` | `plugins/zama-skills/skills/test/scripts/generate.ts` | `--contract Token` | `Token.test.ts` + `Token.sepolia.test.ts` |
| 4 | `/zama-frontend` | `plugins/zama-skills/skills/frontend/scripts/generate.ts` | `--contract Token --with-wagmi` | `fhe.ts`, `useDecrypted.ts`, `EncryptedInput.tsx` |

## Skill SHAs Captured (in `.gsd-snapshot.json`)

```
init     14d9879a8e1c01872d2712d8c30e55745c2fab34
contract 713d063bc736c44a07446f9e0859c0239556c341
test     713d063bc736c44a07446f9e0859c0239556c341
deploy   713d063bc736c44a07446f9e0859c0239556c341
frontend 713d063bc736c44a07446f9e0859c0239556c341
pinned-versions.json sha256: b9957b4b0a2c3ec9e0dd5edae25bf80522a5c129dd84de0f648d39510d0040c5
```

## Compile Verification

```
cd examples/confidential-token
pnpm install                                    → done in 45s, 0 errors
pnpm --filter contracts exec hardhat compile    → "Compiled 15 Solidity files successfully (evm target: paris)"
                                                  → 66 typechain typings generated
```

Compile gate: **GREEN**.

## Scaffold Inventory

23 source files committed under `examples/confidential-token/` (excluding `node_modules/`, `cache/`, `artifacts/`, `typechain-types/`, `fhevmTemp/`).

## Commits

| Hash | Message |
|---|---|
| `d5fd7d5` | `chore(05): scaffold examples/confidential-token via /zama-* skills` (initial scaffold — pre-fix) |
| `bf94fc9` | `fix(05): skill template bugs surfaced by 05-01 dogfooding` |
| `12927ba` | `chore(05): regenerate scaffold + add .gsd-snapshot.json (compile green)` |

## Skill Bugs Surfaced (auto-fixed under Rule 3 — blocking issues)

### SKILL-BUG-01: `_comment_*` keys inside JSON `dependencies`/`devDependencies`

- **Files**: `init/assets/templates/{root-package.json.tpl, packages/{contracts,frontend}/package.json.tpl}`
- **Symptom**: `pnpm install` → `ERR_PNPM_FETCH_404 GET https://registry.npmjs.org/_comment_typescript: Not Found - 404`
- **Cause**: JSON has no comment syntax. pnpm 9 treats every key in a dep map as a real package name.
- **Fix**: Removed the `_comment_*` keys; the rationale they encoded is documented in `shared/pinned-versions.json` and the template file headers.

### SKILL-BUG-02: Missing `ts-node` + `@types/*` in contracts package

- **File**: `init/assets/templates/packages/contracts/package.json.tpl`
- **Symptom**: `hardhat compile` → `Error HH13: Your Hardhat project uses typescript, but ts-node is not installed.`
- **Cause**: Hardhat 2.x requires `ts-node` to load a TypeScript `hardhat.config.ts`. The template had `typescript` but not `ts-node` or `@types/node`.
- **Fix**: Added `ts-node@^10.9.2`, `@types/node@^20.19.30`, `@types/mocha@^10.0.6`, `@types/chai@^4.3.16`.

### SKILL-BUG-03: Wrong OZ import path + non-existent `SepoliaConfig` export

- **File**: `contract/assets/templates/erc7984.sol.tpl`
- **Symptoms**:
  - `Error HH404: File @openzeppelin/confidential-contracts/token/ERC7984.sol ... not found.`
  - `DeclarationError: Declaration "SepoliaConfig" not found in "@fhevm/solidity/config/ZamaConfig.sol".`
- **Causes**:
  1. The actual OZ path under `@openzeppelin/confidential-contracts@0.4.0` is `token/ERC7984/ERC7984.sol`, not `token/ERC7984.sol`.
  2. `SepoliaConfig` was renamed to `ZamaEthereumConfig` in `@fhevm/solidity@0.11.x` (only `ZamaEthereumConfig` is exported as an `abstract contract`).
- **Fix**: Corrected import path; switched the inheritance to `ZamaEthereumConfig`. The plan's `must_haves.truths` line "...has SepoliaConfig" is contradicted by the upstream rename and is annotated in this summary as a documentation update needed for downstream plans.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 3 — Blocking] SKILL-BUG-01 (_comment_* JSON keys)** — fixed in skill templates; scaffold regenerated.
2. **[Rule 3 — Blocking] SKILL-BUG-02 (missing ts-node)** — fixed in skill template; scaffold regenerated.
3. **[Rule 3 — Blocking] SKILL-BUG-03 (wrong OZ path + missing SepoliaConfig)** — fixed in skill template; scaffold regenerated.
4. **[Rule 2 — Critical functionality] Extended `.gitignore`** — the `/zama-init` template's `.gitignore` was missing `.env.deploy.local`, `.next/`, `out/`, `deployments/localhost/`, `fhevmTemp/`. Added per plan task spec.

### Plan↔Skill mismatches surfaced (informational, not deviations)

- Plan frontmatter `files_modified` listed test files as `Token.spec.ts` / `Token.sepolia.spec.ts`. The actual `/zama-test` skill writes `Token.test.ts` / `Token.sepolia.test.ts`. Skill output is canonical (per task CRITICAL note: "If any skill output looks 'wrong', FIX THE SKILL ... do NOT hand-edit the scaffold."). A future plan should reconcile the plan templating with the skill's actual filenames, or add a `.spec.ts` alias to the test skill.
- Plan invocation guidance suggested `pnpm --filter contracts hardhat compile`, which pnpm 9 interprets as a script lookup. Correct invocation under pnpm 9 is `pnpm --filter contracts exec hardhat compile`. Reflected in this summary; future plans should standardize on `exec`.

## Success Criteria

- [x] EXAMPLE-01 baseline established — every committed file under `examples/confidential-token/` is skill-produced (scaffold templates, contract template, test templates, frontend templates) or is the snapshot/`.gitignore`/`pnpm-lock.yaml`. Zero hand-typed contract or frontend code.
- [x] EXAMPLE-04 satisfied — `.gsd-snapshot.json` present with all 5 skill SHAs, `pinned_versions_sha`, scaffold inputs, invocation order.
- [x] Zero deprecated imports — `grep -RE "fhevmjs|\"fhevm\""` returns nothing.
- [x] Hardhat compile green — 15 .sol files compiled, 66 typings generated.
- [x] Plan 02 unblocked — `/zama-frontend`'s `lib/fhe.ts`, `hooks/useDecrypted.ts`, `components/EncryptedInput.tsx` all in place for the Next.js shell to wrap.

## Self-Check: PASSED

Created files verified:
- `examples/confidential-token/.gsd-snapshot.json` ✓
- `examples/confidential-token/scripts/snapshot.mjs` ✓
- `examples/confidential-token/packages/contracts/contracts/Token.sol` ✓
- `examples/confidential-token/packages/contracts/test/Token.test.ts` ✓
- `examples/confidential-token/packages/contracts/test/Token.sepolia.test.ts` ✓
- `examples/confidential-token/packages/frontend/src/lib/fhe.ts` ✓
- `examples/confidential-token/packages/frontend/src/hooks/useDecrypted.ts` ✓
- `examples/confidential-token/packages/frontend/src/components/EncryptedInput.tsx` ✓

Commits verified in `git log`:
- `d5fd7d5` ✓
- `bf94fc9` ✓
- `12927ba` ✓
