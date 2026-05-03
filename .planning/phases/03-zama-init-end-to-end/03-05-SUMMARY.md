---
phase: 03-zama-init-end-to-end
plan: 05
title: Helpers — preflight + closing-summary
status: complete
completed: 2026-05-03
---

# Phase 03 Plan 05: Helpers Summary

`/zama-init` için iki TypeScript yardımcı eklendi; ikisi de hem fonksiyon olarak hem `tsx` CLI olarak çağrılabiliyor.

## Public API

**`preflight.ts`**
- `runPreflight(opts?: { skipNetwork?, pnpmCmd?, nodeVersion?, timeoutMs? }): Promise<{ ok, failures, details }>`
- CLI: argümansız; stdout=JSON, stderr=özet, exit 0/1
- Üç kontrol: Node ≥ 20, `pnpm --version`, npm registry HEAD probe (Node native `https`, 3s timeout)

**`closing-summary.ts`**
- `renderClosingSummary(manifest, ctx): string` — saf fonksiyon
- Çalışma anında okunan: `shared/prompts/closing-summary.md`, `shared/snippets/versions-table.md`, `shared/snippets/sepolia-faucet.md`
- 7 placeholder substituted; MetaMask deep-link + context7 güvence + commands-passed kuyruğu eklenir
- CLI: `--manifest <path>` veya stdin, `--use-case`, `--shared-dir`

## Dosyalar

- `plugins/zama-skills/skills/init/scripts/preflight.ts` (new)
- `plugins/zama-skills/skills/init/scripts/closing-summary.ts` (new)

## Sapmalar

`ScaffoldManifest` tipi `closing-summary.ts` içinde lokal tanımlandı; `scripts/lib/manifest.ts` (Plan 03-04, aynı wave) henüz yok. 03-04 indiğinde import ile değiştirilecek — kod yorumda not düşüldü.

## Commits

- `feat(03-05): add preflight.ts environment checks`
- `feat(03-05): add closing-summary.ts renderer`

## Self-Check: PASSED

- `plugins/zama-skills/skills/init/scripts/preflight.ts` FOUND
- `plugins/zama-skills/skills/init/scripts/closing-summary.ts` FOUND
- Smoke run: preflight `ok=true`; closing-summary çıktısı tüm zorunlu satırları içeriyor (chainid, context7, NOT-done, /zama-contract).
