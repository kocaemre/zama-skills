---
phase: 04-other-4-skills
plan: 04
subsystem: skills/frontend
tags: [skill, frontend, react, relayer-sdk, wagmi, typechain, tdd]
requires:
  - shared/pinned-versions.json (relayer-sdk, ethers, typechain pins)
  - shared/deprecated-imports.json (fhevmjs/fhevm refusal list)
provides:
  - /zama-frontend skill (workflow body + generator + 4 templates)
  - generateFrontend({workspaceRoot, contract, withWagmi, force}) export
  - runFrontendPreflight({workspaceRoot}) export
affects:
  - plugins/zama-skills/skills/frontend/
tech-stack:
  added: []   # all libs already pinned in shared/pinned-versions.json
  patterns:
    - "Lazy SDK singleton via in-flight init promise (no double-load of wasm)"
    - "Explicit 4-state machine in React hook (no boolean isLoading)"
    - "Blur-encrypt controlled input with euint bounds-check before SDK call"
    - "Post-write tripwire grep against deprecated package names with rollback"
    - "Wagmi opt-in via template swap (no runtime conditional in generated code)"
key-files:
  created:
    - plugins/zama-skills/skills/frontend/scripts/generate.ts
    - plugins/zama-skills/skills/frontend/scripts/generate.test.ts
    - plugins/zama-skills/skills/frontend/scripts/lib/preflight.ts
    - plugins/zama-skills/skills/frontend/assets/templates/fhe.ts.tpl
    - plugins/zama-skills/skills/frontend/assets/templates/fhe-wagmi.ts.tpl
    - plugins/zama-skills/skills/frontend/assets/templates/useDecrypted.ts.tpl
    - plugins/zama-skills/skills/frontend/assets/templates/EncryptedInput.tsx.tpl
    - .planning/phases/04-other-4-skills/deferred-items.md
  modified:
    - plugins/zama-skills/skills/frontend/SKILL.md
decisions:
  - "Used template swap (fhe.ts.tpl vs fhe-wagmi.ts.tpl) instead of single template with conditional — keeps generated code free of dead branches"
  - "Post-grep regex matches the literal token 'fhevmjs' anywhere (incl. comments) — forces template authors to spell the deprecated name nowhere, even in 'do-not-use' comments"
  - "fhe.ts chainId guard logs console.warn rather than throwing — wallet may settle Sepolia after page load; throwing breaks SSR/hydration"
  - "Bounds-check in EncryptedInput is BigInt-based to avoid Number precision loss above 2^53 for euint64"
metrics:
  duration_minutes: ~28
  tasks_completed: 2
  commits: 3
  files_created: 8
  files_modified: 1
  tests_added: 15
  tests_passing: 15
---

# Phase 04 Plan 04: zama-frontend Skill Summary

`/zama-frontend` skill that materializes 3 React/TS files (`src/lib/fhe.ts`, `src/hooks/useDecrypted.ts`, `src/components/EncryptedInput.tsx`) wiring `@zama-fhe/relayer-sdk` into a `/zama-init`-scaffolded frontend, with explicit 4-state decryption UX and ethers/typechain v6 enforcement.

## What was built

### Task 1 — SKILL.md workflow body (commit `146f1aa`)

Replaced the Phase 1 skeleton with the full 5-step `/zama-frontend` workflow:

1. **Pre-flight** — detect workspace, refuse `ethers ^5` or `@typechain/ethers-v5`, print verbatim migration command.
2. **AskUserQuestion: Wagmi+viem?** — yes/no opt-in. Yes → `--with-wagmi` flag.
3. **AskUserQuestion: which contract?** — auto-suggest from `packages/frontend/src/abis/*.json` glob.
4. **Generate** — call `tsx ${CLAUDE_SKILL_DIR}/scripts/generate.ts --contract <Name> [--with-wagmi]`.
5. **Closing summary** — print 3 file paths, explain the "awaiting relayer (5–10s on Sepolia)" UX state, and embed a sample `useDecrypted` + `EncryptedInput` rendering snippet that exercises all 4 status branches.

`allowed-tools` restricted to `AskUserQuestion, Bash, Read, Write, Edit, Glob, Grep, WebFetch`.

### Task 2 — Generator + preflight + 4 templates (commits `e730ecd` RED, `e5a05ae` GREEN)

**TDD cycle.** RED: 15 vitest cases authored against the un-implemented `generateFrontend` and `runFrontendPreflight` symbols (all failed with `Failed to load url ./generate.js` as expected). GREEN: implementation made all 15 pass; project typecheck clean.

**Files emitted by the generator (via templates):**

| Path | Template | Notes |
|------|----------|-------|
| `packages/frontend/src/lib/fhe.ts` | `fhe.ts.tpl` (default) or `fhe-wagmi.ts.tpl` (`--with-wagmi`) | Lazy `getFhevmInstance()` singleton; `initSDK()` + `createInstance({...SepoliaConfig, network})`; chainId warn |
| `packages/frontend/src/hooks/useDecrypted.ts` | `useDecrypted.ts.tpl` | Pure React hook, 4 status states, `request()` user-triggered |
| `packages/frontend/src/components/EncryptedInput.tsx` | `EncryptedInput.tsx.tpl` | Controlled input, blur-encrypt, BigInt bounds-check vs `euint8/16/32/64` max, emits `{ handle, inputProof }` |

**Generator behaviors verified by tests:**

- 3 expected files written (vanilla path).
- Wagmi shim swapped into `fhe.ts` only with `--with-wagmi`; vanilla path uses `window.ethereum`.
- 4 status string literals (`'idle'`, `'requesting'`, `'decrypted'`, `'error'`) appear verbatim in `useDecrypted.ts`.
- `createEncryptedInput`, `handle`, `inputProof`, `onEncrypted` all appear in `EncryptedInput.tsx`.
- Post-grep tripwire: zero `fhevmjs` matches in any output (the templates also never spell that token, even in comments — a self-imposed discipline that makes the tripwire cheap and false-positive-free).
- `--force` overwrite: refused without flag, accepted with flag.
- Preflight propagates: ethers v5 in fixture → generator returns `ok:false` with `error: /ethers/`.
- Migration command embedded verbatim in failure messages: `pnpm remove @typechain/ethers-v5 && pnpm add -D @typechain/ethers-v6 ethers@^6`.

## Threat-model coverage

| Threat ID | Disposition | Mitigation in this plan |
|-----------|-------------|--------------------------|
| T-04-19 (fhevmjs import) | mitigate | `generate.ts` post-grep aborts and rolls back writes if any output contains `fhevmjs`. Templates contain zero references. |
| T-04-20 (typechain v5 silent mix) | mitigate | `runFrontendPreflight` reads `packages/frontend/package.json`, refuses on `@typechain/ethers-v5` or `ethers ^5`, returns migration cmd. |
| T-04-22 (wallet on wrong chain) | mitigate | `fhe.ts` calls `eth_chainId` and `console.warn`s on non-Sepolia (does not throw — see decisions). |
| T-04-24 (euint overflow at input) | mitigate | `EncryptedInput` bounds-checks BigInt value against `MAX_FOR[type]` before calling `createEncryptedInput`. |
| T-04-21 (decrypt logged to console) | accept | User-controlled, no PII. |
| T-04-23 (parallel decrypt requests) | accept | Hook uses `inFlight` ref to coalesce; `request()` is user-triggered. |

## Verification

- **vitest:** `npx vitest run plugins/zama-skills/skills/frontend/scripts/generate.test.ts` → **15 passed**.
- **typecheck:** `npm run typecheck` → clean (`tsc --noEmit` exit 0).
- **SKILL.md keywords:** automated check passed (`AskUserQuestion`, `useDecrypted`, `EncryptedInput`, `awaiting relayer`, `typechain` all present).
- **Manual sample-usage snippet:** present in SKILL.md (covers all 4 status branches).

## Sample usage snippet (also in SKILL.md)

```tsx
import { useDecrypted } from "@/hooks/useDecrypted";
import { EncryptedInput } from "@/components/EncryptedInput";

function CounterPanel({ contractAddress, handle }: { contractAddress: `0x${string}`; handle: string | null }) {
  const decrypt = useDecrypted<bigint>(handle);
  return (
    <>
      <EncryptedInput contractAddress={contractAddress} type="euint64" onEncrypted={({ handle, inputProof }) => { /* ... */ }} />
      {decrypt.status === "idle" && <button onClick={decrypt.request}>Reveal my balance</button>}
      {decrypt.status === "requesting" && <p>Awaiting relayer… (5–10s on Sepolia)</p>}
      {decrypt.status === "decrypted" && <p>Balance: {String(decrypt.value)}</p>}
      {decrypt.status === "error" && <p>Decrypt failed: {decrypt.error?.message}</p>}
    </>
  );
}
```

Skill location reference: `plugins/zama-skills/skills/frontend/SKILL.md`

## Deviations from plan

### Auto-fixed issues

**1. [Rule 1 — Bug] Templates contained the literal token `fhevmjs` in deprecation-warning comments**
- **Found during:** Task 2 GREEN, first vitest run after writing templates + generator.
- **Issue:** The post-grep tripwire (per plan: `'fhevmjs' → 0 matches in any generated file`) tripped on a comment string in `fhe.ts.tpl` (`"// Replaces deprecated \`fhevmjs\` ..."`) and `fhe-wagmi.ts.tpl` (`"// instead of window.ethereum"` indirectly via test).
- **Fix:** Reworded both comments to avoid spelling the deprecated name. Discipline rationale captured in decisions section.
- **Files modified:** `fhe.ts.tpl`, `fhe-wagmi.ts.tpl`.
- **Commit:** rolled into `e5a05ae` (GREEN commit) since the tripwire surfaced before any prior commit could land the bad templates.

### Threat-model alignment

All `mitigate` dispositions in the plan's `<threat_model>` are addressed in code (T-04-19/20/22/24). No new security-relevant surface beyond what the plan declared.

## Deferred issues (out of scope)

- `scripts/validate.test.ts` has 3 pre-existing failures in the `runSync drift detection` suite. Confirmed pre-existing (independent of all changes in this plan); logged to `.planning/phases/04-other-4-skills/deferred-items.md`. Not introduced by plan 04-04.

## Known stubs

None. The generator emits self-contained, typecheck-clean React/TS files. The `userDecrypt` call in `useDecrypted.ts` uses a structural type cast for the relayer-sdk surface (the SDK's full typed call signature requires EIP-712 plumbing that downstream apps already have); the cast is documented inline as a deliberate, narrow surface. This is a conventional integration boundary, not a stub.

## TDD Gate Compliance

- **RED gate** (`test(04-04): add failing tests…`): commit `e730ecd` — vitest exited 1 with module-not-found errors as expected.
- **GREEN gate** (`feat(04-04): implement /zama-frontend generator…`): commit `e5a05ae` — vitest 15/15 passing.
- **REFACTOR gate**: skipped — initial implementation was simple enough not to warrant a cleanup pass.

## Self-Check: PASSED

- `plugins/zama-skills/skills/frontend/SKILL.md` — FOUND
- `plugins/zama-skills/skills/frontend/scripts/generate.ts` — FOUND
- `plugins/zama-skills/skills/frontend/scripts/generate.test.ts` — FOUND
- `plugins/zama-skills/skills/frontend/scripts/lib/preflight.ts` — FOUND
- `plugins/zama-skills/skills/frontend/assets/templates/fhe.ts.tpl` — FOUND
- `plugins/zama-skills/skills/frontend/assets/templates/fhe-wagmi.ts.tpl` — FOUND
- `plugins/zama-skills/skills/frontend/assets/templates/useDecrypted.ts.tpl` — FOUND
- `plugins/zama-skills/skills/frontend/assets/templates/EncryptedInput.tsx.tpl` — FOUND
- Commit `146f1aa` (Task 1) — FOUND
- Commit `e730ecd` (RED) — FOUND
- Commit `e5a05ae` (GREEN) — FOUND
