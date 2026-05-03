---
phase: 03-zama-init-end-to-end
plan: 02
subsystem: skills/init/assets
tags: [templates, scaffold, pnpm-workspace, hardhat, vite]
requires: [shared/pinned-versions.json]
provides: [13 .tpl files for /zama-init scaffold runtime]
affects: [03-04 scaffold.ts (consumer of these templates)]
tech-stack:
  added: []
  patterns: ["@pin:<pkg> placeholders", "{{USE_CASE}} / {{USE_CASE_TITLE}} runtime substitutions"]
key-files:
  created:
    - plugins/zama-skills/skills/init/assets/templates/pnpm-workspace.yaml.tpl
    - plugins/zama-skills/skills/init/assets/templates/root-package.json.tpl
    - plugins/zama-skills/skills/init/assets/templates/root-readme.md.tpl
    - plugins/zama-skills/skills/init/assets/templates/.env.example.tpl
    - plugins/zama-skills/skills/init/assets/templates/.gitignore.tpl
    - plugins/zama-skills/skills/init/assets/templates/packages/contracts/package.json.tpl
    - plugins/zama-skills/skills/init/assets/templates/packages/contracts/hardhat.config.ts.tpl
    - plugins/zama-skills/skills/init/assets/templates/packages/contracts/tsconfig.json.tpl
    - plugins/zama-skills/skills/init/assets/templates/packages/frontend/package.json.tpl
    - plugins/zama-skills/skills/init/assets/templates/packages/frontend/vite.config.ts.tpl
    - plugins/zama-skills/skills/init/assets/templates/packages/frontend/index.html.tpl
    - plugins/zama-skills/skills/init/assets/templates/packages/frontend/src/main.tsx.tpl
    - plugins/zama-skills/skills/init/assets/templates/packages/frontend/src/App.tsx.tpl
  modified: []
decisions:
  - "@pin:<pkg> placeholder syntax (matches scripts/build.ts examples handler) — versions stay only in pinned-versions.json"
  - "typescript ve react/react-dom hardcoded (top-level / dışsal) — pinned-versions.json packages bölümünde değil"
  - "README readme'de 'fhevmjs' gibi deprecated isimleri telaffuz etme — paragraph yeniden yazıldı (deprecation guard belt-and-suspenders kontrolü için)"
  - "Frontend tsconfig.json.tpl planda listelenmediği için eklenmedi; build script'i sadece 'vite build' kullanır"
metrics:
  duration: 156s
  completed: 2026-05-03
---

# Phase 03 Plan 02: Asset Templates Summary

`/zama-init` scaffold'unun 13 `.tpl` template dosyası eklendi — pnpm workspace + Hardhat + Vite/React 18, hepsi `@pin:<pkg>` placeholder'larıyla.

## Eklenen dosyalar (13)

| Dosya | Boyut |
|---|---|
| pnpm-workspace.yaml.tpl | 27 B |
| root-package.json.tpl | 582 B |
| root-readme.md.tpl | 3627 B |
| .env.example.tpl | 660 B |
| .gitignore.tpl | 98 B |
| packages/contracts/package.json.tpl | 2398 B |
| packages/contracts/hardhat.config.ts.tpl | 997 B |
| packages/contracts/tsconfig.json.tpl | 507 B |
| packages/frontend/package.json.tpl | 645 B |
| packages/frontend/vite.config.ts.tpl | 162 B |
| packages/frontend/index.html.tpl | 310 B |
| packages/frontend/src/main.tsx.tpl | 209 B |
| packages/frontend/src/App.tsx.tpl | 767 B |

**Toplam:** 13 dosya / 10.989 B.

## @pin anahtarları kullanıldı

`@fhevm/solidity`, `@fhevm/hardhat-plugin`, `@fhevm/mock-utils`, `@fhevm/host-contracts`, `@zama-fhe/relayer-sdk`, `@zama-fhe/relayer-sdk-dev`, `@openzeppelin/confidential-contracts`, `@openzeppelin/contracts`, `encrypted-types`, `solc`, `hardhat`, `ethers`, `@nomicfoundation/hardhat-{ethers,chai-matchers,network-helpers,verify}`, `hardhat-deploy`, `hardhat-gas-reporter`, `solidity-coverage`, `@typechain/{ethers-v6,hardhat}`, `typechain`, `dotenv`, `cross-env`, `mocha`, `chai`, `chai-as-promised`, `rimraf`, `solhint`, `prettier-plugin-solidity`, `prettier`, `eslint`, `typescript-eslint`.

## Runtime substitutions (03-04 implement etmeli)

- `{{USE_CASE}}` → kebab-case (örn. `voting`) — root package.json `name` alanında.
- `{{USE_CASE_TITLE}}` → Title-Case (örn. `Voting`) — README H1, frontend index.html `<title>`, App.tsx h1.

## Doğrulama

- 13 `.tpl` dosyası mevcut (find ile doğrulandı).
- `fhevmjs` veya `"fhevm":` recursive grep — sıfır eşleşme.
- `.env.example` 5 anahtar (INFURA, MNEMONIC, ETHERSCAN, RELAYER_URL, SEPOLIA_RPC_URL).
- README chainid.network deep-link + 5 faucet referansı içerir.
- `hardhat.config.ts.tpl` `@fhevm/hardhat-plugin` import + `@pin:solc`.

## Sapmalar

Yok — plan sözleşmesi aynen uygulandı. README'deki tek bir cümle deprecated paket adını çıplak yazıyordu (deprecation guard'ı tetiklerdi); açıklayıcı ifadeyle değiştirildi.

## Self-Check: PASSED
- 13 .tpl dosyası mevcut (FOUND, find ile sayıldı).
- Commits: 9ea89da (Task 1, FOUND), 724bc7c (Task 2, FOUND), 6c39827 (Task 3, FOUND).
