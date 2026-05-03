---
phase: 03-zama-init-end-to-end
plan: 07
title: validate.ts asset denetimi uzantısı
status: complete
date: 2026-05-03
files_modified:
  - scripts/validate.ts
  - scripts/validate.test.ts
commits:
  - feat(03-07): add init-skill asset audit to pnpm validate
  - test(03-07): cover auditInitAssets (happy + 4 negative cases)
---

# 03-07 Özet — validate.ts Asset Denetimi

`pnpm validate` boru hattına `auditInitAssets` adımı eklendi. Üç kontrol: (1) zorunlu dosya beyaz listesi (5 root tpl, 5 contracts/frontend tpl, 4 use-case seed), (2) tüm `<!-- @pin:<key> -->` referansları `pinned-versions.json` paketleri + `solc` + `@zama-fhe/relayer-sdk-dev` aliası kümesinde mi, (3) `fhevmjs` / `"fhevm":` deprecation grep'i — `//`, `*`, `/*`, `#` ile başlayan yorum satırları izinli (Skeleton.sol banner'ı için).

Hata öneki tüm yeni hatalarda `Asset audit failed:`. Mevcut drift/marketplace/frontmatter kontrolleri bozulmadı. Yeni CI işi yok. 5 yeni vitest case (happy + missing-file + unknown-pin + deprecation hit + comment allow) — 10/10 yeşil.

## Self-Check: PASSED

- scripts/validate.ts: FOUND
- scripts/validate.test.ts: FOUND
- commit feat(03-07): FOUND
- commit test(03-07): FOUND
- pnpm validate: green
- pnpm typecheck: green
- vitest scripts/validate.test.ts: 10/10 pass
