---
phase: 03-zama-init-end-to-end
plan: 06
title: Tests + smoke harness
status: complete
completed: 2026-05-03
---

# Phase 03 Plan 06: Tests & Smoke Summary

`/zama-init` runtime'ı için vitest kapsama + opt-in end-to-end smoke harness eklendi.

## Test envanteri (5 dosya, 35 test)

- `lib/pin-resolver.test.ts` — 7 test: solc özel-case, alias key (`@zama-fhe/relayer-sdk-dev`), unknown-key throw, multi-pin, no-op.
- `preflight.test.ts` — 7 test: Node 18/20/22 dalları, fake `pnpmCmd`, `skipNetwork`, `timeoutMs:1` ile ağ timeout, çoklu failure birleşimi.
- `closing-summary.test.ts` — 12 test: MetaMask + context7 kuyruk satırları, `{{SKILL_NAME}}` / `{{NEXT_SKILL_REASON}}` (token vs voting vs auction), file grouping, 30-cap + `(+N more)`, `coerceManifest` her iki form.
- `scaffold.test.ts` — 8 test: gerçek `os.tmpdir()`, `--no-install/--no-compile`, `<!-- @pin: -->` artığı yok, `--force` guard, `postGrep` fhevmjs import + dep tespiti, comment ve `node_modules` allowlist.
- `tests/integration/zama-init-smoke.test.ts` — 1 test: `ZAMA_INIT_SMOKE=1` gated; `tsx scaffold.ts` spawn → manifest JSON parse → `pnpm install` + `hardhat compile` + deprecation grep tümü `ok`.

## Smoke gating

`describe.skipIf(!SMOKE)` — varsayılan `pnpm test` 1.1s, smoke skipped. `pnpm test:smoke` (~3-5 dk soğuk cache) Phase 6 release-checklist gate'i için zorunlu.

## Sapmalar

Yok — preflight zaten DI shape'ini taşıyordu (Plan 03-05 sırasında doğru yapılmış); plan'ın "small revision to 03-05 gerekli" notu artık geçersiz. Network failure mocking için `https` modül stub'ı yerine `timeoutMs:1` kullanıldı (daha basit, deterministik).

## Commits

- `test(03-06): add unit coverage for pin-resolver, preflight, closing-summary` (7c52632)
- `test(03-06): add scaffold fs tests + opt-in zama-init smoke harness` (5a9953a)

## Self-Check: PASSED

- 5 test dosyası FOUND.
- `pnpm test`: 65 passed / 1 skipped, 1.1s.
- `package.json` `"test:smoke"` script FOUND.
- Commits 7c52632, 5a9953a FOUND.
