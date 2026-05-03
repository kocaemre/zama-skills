---
phase: 03-zama-init-end-to-end
plan: 04
subsystem: skills/init/scripts
tags: [scaffold, runtime, tsx, fs-extra, deprecation-guard]
requires:
  - plugins/zama-skills/shared/pinned-versions.json
  - plugins/zama-skills/skills/init/assets/templates/**
  - plugins/zama-skills/skills/init/assets/seeds/**
provides: [scaffold runtime + manifest type + pin resolver]
affects: [03-05 closing-summary.ts (refactored to import canonical type), 03-06 tests]
key-files:
  created:
    - plugins/zama-skills/skills/init/scripts/scaffold.ts
    - plugins/zama-skills/skills/init/scripts/lib/pin-resolver.ts
    - plugins/zama-skills/skills/init/scripts/lib/manifest.ts
  modified:
    - plugins/zama-skills/skills/init/scripts/closing-summary.ts
metrics:
  completed: 2026-05-03
  tasks: 2
---

# Phase 03 Plan 04: Scaffold Runtime Summary

`/zama-init` çalışma anı orkestratörü; template + seed materialize → install → compile → deprecation grep → manifest JSON.

## CLI

```
tsx scaffold.ts --use-case <token|confidential-token|voting|auction|custom> --target <dir> [--force] [--no-install] [--no-compile]
tsx scaffold.ts --post-grep <dir>
```

`token` → `confidential-token` aliası normalize edilir.

## Manifest Şeması

`lib/manifest.ts`: `{ useCase, targetDir, filesWritten:{path,bytes}[], pinsResolved:Record, commandsRan:{cmd,cwd,ok,durationMs}[], deprecationGrep:{ok}|{ok,matches} }`. Tek satır JSON stdout'a yazılır; closing-summary pipe ile tüketir.

## Plugin-Root Discovery

`shared/pinned-versions.json` markerını ararken (a) script konumundan (`import.meta.url`) ve (b) cwd'den 12 seviyeye kadar yukarı yürür. Bulamazsa actionable hata. Repo'daki `scripts/lib/versions.ts`e import bağımlılığı YOK — installed `~/.claude/skills/` yolunda yaşamayacağı için JSON doğrudan okunur.

## Template Resolver Özel Vakaları

- `<!-- @pin:solc -->` → `compiler.solc` top-level (ör. `0.8.27`)
- `<!-- @pin:@zama-fhe/relayer-sdk-dev -->` → `0.4.1` exact (alias entry)
- `{{USE_CASE}}` (kebab) ve `{{USE_CASE_TITLE}}` (Title Case) pin sonrası uygulanır
- `root-package.json.tpl` → `package.json`, `root-readme.md.tpl` → `README.md`
- Bilinmeyen `@pin:` anahtarı → throw (`Unknown @pin reference: <key>`)

## Deprecation Grep Allowlist

- Yorum satırları (`//`, `*`, `/*`, `#`) atlanır → Skeleton.sol deprecation banner false-positive vermez
- `node_modules`, `.git`, `cache`, `artifacts`, `typechain-types`, `dist`, `.pnpm-store` skip
- `package.json`: `"fhevmjs":` veya `"fhevm":` JSON dep girdileri
- Kaynak dosya: `from/import/require("fhevmjs"|"fhevm/...")` import-statement biçimleri

## closing-summary.ts Refactoru

03-05 SUMMARY'sinde işaretlenen lokal `ScaffoldManifest` kopyası kaldırıldı; `./lib/manifest.js`ten import edilen kanonik tip + `coerceManifest()` shim ile hem yeni `{path,bytes}[]` hem eski `string[]` formatı kabul edilir.

## Sapmalar

- ORCHESTRATION.md "React-Template Drift Risk" notuna uygun olarak fhevm-react-template **clone EDİLMEZ** — scaffold.ts üst yorum bloğunda gerekçesi belgelendi.
- CONTEXT.md "fork & post-process" cümlesinden bilinçli sapma; ORCHESTRATION'da onaylı.

## Commits

- `feat(03-04): add pin-resolver + manifest libs`
- `feat(03-04): add scaffold.ts runtime orchestrator`
- `refactor(03-04): closing-summary.ts imports canonical ScaffoldManifest`

## Self-Check: PASSED

- `plugins/zama-skills/skills/init/scripts/scaffold.ts` FOUND
- `plugins/zama-skills/skills/init/scripts/lib/pin-resolver.ts` FOUND
- `plugins/zama-skills/skills/init/scripts/lib/manifest.ts` FOUND
- 4 dosya (yukarıdakiler + closing-summary.ts) izole `tsc --noEmit` ile sıfır hata
- `--post-grep templates/` exit 0; `--post-grep seeds/` exit 0 (yorumlar allowlist); sentetik `import "fhevmjs"` exit 1
- Smoke scaffold (`--use-case voting --no-install --no-compile`) 14 dosya yazdı; çözülmemiş `@pin:` veya `{{USE_CASE}}` kalmadı
