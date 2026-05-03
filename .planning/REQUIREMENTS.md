# Requirements: zama-skills

**Defined:** 2026-05-03
**Core Value:** Bir geliştirici Claude Code'da `/zama-init` yazdığında, FHE bilgisi olmadan bile, çalışan ve deploy edilmiş bir confidential dApp ile sohbeti bitirebilmeli — tüm üretilen kod context7 üzerinden resmi Zama dokümantasyonundan doğrulanmış.

## v1 Requirements

### Plugin Foundation (PLUGIN)

- [ ] **PLUGIN-01**: Geçerli `marketplace.json` ve `plugin.json` ile tek komutta kurulum (`/plugin marketplace add` + `/plugin install zama-skills@zama-skills`)
- [ ] **PLUGIN-02**: 5 SKILL.md dosyası (init/contract/test/deploy/frontend) — frontmatter eksiksiz: `name`, `description`, `when_to_use` (toplam ≤1536 char)
- [ ] **PLUGIN-03**: `/zama-deploy` skill'inde `disable-model-invocation: true` (otonom deploy önleme)
- [ ] **PLUGIN-04**: Her skill'de `allowed-tools` whitelist (permission prompt baskısı yok)
- [ ] **PLUGIN-05**: `npx zama-skills install` ile alternatif kurulum yolu (npm package)
- [x] **PLUGIN-06**: Plugin schema validasyonu CI'da koşar (zod), `npm publish` öncesi yeşil zorunlu

### Shared Infrastructure (SHARED)

- [ ] **SHARED-01**: `shared/pinned-versions.json` — tüm `@fhevm/*` ve OZ versiyonları tek kaynaktan; `scripts/sync-versions.mjs` ile skill template'lerine yayılır
- [ ] **SHARED-02**: `shared/context7-query.md` — her skill'de transclusion ile dahil edilen "önce context7 sorgula" prompt fragment'i
- [ ] **SHARED-03**: `shared/deprecated-imports.json` — `fhevmjs`, `fhevm` (root) ve diğer deprecated paketlerin yasak listesi
- [ ] **SHARED-04**: `scripts/build.mjs` — SKILL.md transclusion engine (`<!-- include: -->`) + manifest validate + generic markdown generate
- [ ] **SHARED-05**: `shared/prompts/` — yeniden kullanılan prompt'lar: anti-deprecation, decryption-paths decision tree, closing-summary template

### Headline Skill — `/zama-init` (INIT)

- [ ] **INIT-01**: Kullanıcıya use-case sorar (token / voting / auction / custom) ve uygun template branch'ine yönlendirir
- [ ] **INIT-02**: `fhevm-react-template` fork edip pinned versiyonlarla customize eder; deprecated paket emit etmez
- [ ] **INIT-03**: `.env.example` üretir (Sepolia RPC URL, mnemonic, Etherscan API key, relayer URL, registry adresi)
- [ ] **INIT-04**: MetaMask'a Sepolia ekleme deep-link içerir (manual config eliminer)
- [ ] **INIT-05**: Kapanış özeti — tam olarak ne kuruldu, sıradaki adımlar (compile/test/deploy/frontend), hangi skill ne için kullanılır
- [ ] **INIT-06**: Manuel smoke test: temiz dizinde çalışıyor → `pnpm install` başarılı → `pnpm hardhat compile` yeşil

### Skill — `/zama-contract` (CONTRACT)

- [ ] **CONTRACT-01**: `euint8/16/32/64`, `ebool`, `eaddress` doğru tipte üretir; cleartext leak pattern'lerini (`require(decrypt(...))`) reddeder
- [ ] **CONTRACT-02**: Her state-write sonrası `FHE.allowThis(handle)` + gerekirse `FHE.allow(handle, msg.sender)` üretir (A1 önleme)
- [ ] **CONTRACT-03**: OpenZeppelin Confidential Contracts (ERC-7984 token, governance) doğru import + extend pattern'i
- [ ] **CONTRACT-04**: Üç decryption path'ini (public / user / oracle) ayırt eder; kullanıcıya hangisinin uygun olduğunu sorar
- [ ] **CONTRACT-05**: HCU budget (20M/tx, 5M depth) hatırlatması ve karmaşık döngülerden kaçınma rehberi

### Skill — `/zama-test` (TEST)

- [ ] **TEST-01**: Mock test pattern üretir — `@fhevm/hardhat-plugin` ile encrypted input mock + decrypt assertion
- [ ] **TEST-02**: Sepolia integration test scaffold üretir — gerçek deploy + gerçek encrypted input + gerçek decrypt
- [ ] **TEST-03**: Test'lerde `FHE.allowThis` doğrulaması (önceki call sonrası decrypt çalıştığını teyit)
- [ ] **TEST-04**: HCU budget aşılırsa Sepolia'da revert edeceği uyarısı; mock'un bunu yakalamayacağı not'u

### Skill — `/zama-deploy` (DEPLOY)

- [ ] **DEPLOY-01**: Sepolia testnet'e deploy script + Etherscan verify + ABI export
- [ ] **DEPLOY-02**: Confidential Token Registry'ye (Sepolia) auto-registration (varsa token deploy ediliyorsa)
- [ ] **DEPLOY-03**: Sepolia adres listesini canlı `WebFetch` ile çeker (pin etmez — Zama günceller)
- [ ] **DEPLOY-04**: `.env` doğrulama — eksik environment variable'ları net hata mesajıyla bildirir, üzerine deploy denemez
- [ ] **DEPLOY-05**: `disable-model-invocation: true` (kullanıcı onayı şart)

### Skill — `/zama-frontend` (FRONTEND)

- [ ] **FRONTEND-01**: `@zama-fhe/relayer-sdk` ile `SepoliaConfig` init + Wagmi/Viem entegrasyonu
- [ ] **FRONTEND-02**: `useDecrypted(handle)` React hook — "awaiting relayer" UX state'i ile
- [ ] **FRONTEND-03**: Encrypted input component pattern (input → public key encrypt → contract call)
- [ ] **FRONTEND-04**: ethers v6 + typechain entegrasyonu (v5 değil — uyumsuzluk uyarısı dahil)

### Reference Example dApp (EXAMPLE)

- [ ] **EXAMPLE-01**: `examples/confidential-token/` — `/zama-init` + `/zama-contract` + diğerleriyle hand-curated, çalışan confidential token dApp
- [ ] **EXAMPLE-02**: Sepolia'da deploy edilmiş + Etherscan'de verify + Confidential Token Registry'de kayıtlı
- [ ] **EXAMPLE-03**: Vercel'de canlı frontend URL — gerçek encrypted input + decrypt akışı çalışıyor
- [ ] **EXAMPLE-04**: `.gsd-snapshot.json` — bu örneğin hangi skill konfigürasyonundan üretildiği kayıtlı
- [ ] **EXAMPLE-05**: CI smoke-diff — taze skill çıktısıyla key dosyalar (deps, hardhat config) karşılaştırılır

### Distribution & Submission (DIST)

- [ ] **DIST-01**: README — hero + 30 saniyelik değer önerisi + tek satır install + 90 sn demo video + skills tablosu + canlı dApp URL'si fold üstünde
- [ ] **DIST-02**: Generic markdown rehberler — `generic/*.md` her SKILL.md'den otomatik üretilir; CI drift kontrolü
- [ ] **DIST-03**: `THIRD_PARTY_LICENSES.md` — fhEVM, OZ Confidential Contracts, FHE.js lisansları audit edilmiş
- [ ] **DIST-04**: `npm publish` — `zama-skills` paketi yayında; `npx zama-skills install` çalışıyor
- [ ] **DIST-05**: GitHub repo public, `/plugin marketplace add` URL'si test edilmiş
- [ ] **DIST-06**: Clean-VM end-to-end test — sıfırdan kurulum → ilk dApp deploy çalıştı (deadline'dan ≥24 saat önce)
- [ ] **DIST-07**: Submission ≥24 saat erken (deadline 2026-05-10 23:59 AOE; hedef 2026-05-09)

## v2 Requirements

### Audit & Debug Skills

- **AUDIT-01**: `/zama-audit` — FHE-aware code review (decrypt yanlış yer, ACL atlama, plaintext leak, HCU patlamaları)
- **DEBUG-01**: `/zama-debug` — yaygın FHE hatalarını teşhis (allowThis unutma, mock-only test, deprecated import, vs.)

### Quality of Life

- **QOL-01**: `/zama-deploy` öncesi `disable-model-invocation` yerine progressive PostToolUse hook (D3 — eğer Phase 6'da boşluk varsa v1'e taşınabilir)
- **QOL-02**: Native Cursor `.cursorrules` formatı (sadece markdown rehber yerine)
- **QOL-03**: Mainnet deploy desteği (audit + risk eklenince)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom MCP server | Context7'de `/zama-ai/fhevm` (1772 snippet, High rep), `/zama-ai/fhevm-hardhat-template`, `/websites/openzeppelin_confidential-contracts` zaten var; reinvent değer katmaz |
| `/zama-audit` (FHE-aware review) | 7 günde "exceptional" kalitede review skill'i yapmak orta seviye FHE deneyimiyle risk; ana scope'u zayıflatır → v2 |
| `/zama-debug` (FHE hata teşhisi) | Aynı sebep — v2 |
| Mainnet deploy | Ek auditing/risk gerektirir; v1 sadece Sepolia testnet |
| Cursor `.cursorrules` native format | Generic markdown rehberler dolaylı destek sağlar; native entegrasyon submission sonrası |
| Hardhat 3.x desteği | fhevm-plugin peer-deps Hardhat 2 only; resmi destek gelene kadar v2 |
| ethers v5 desteği | Plugin + typechain v6 zorunlu; v5 = bozuk install |
| Reserved marketplace adları | `agent-skills`, `claude-code-marketplace`, `claude-plugins-official`, vs. — `zama-skills` adı kullanılacak |

## Traceability

Roadmap created 2026-05-03. All 41 v1 requirements mapped to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLUGIN-01 | Phase 1 | Pending |
| PLUGIN-02 | Phase 1 | Pending |
| PLUGIN-03 | Phase 1 | Pending |
| PLUGIN-04 | Phase 1 | Pending |
| PLUGIN-05 | Phase 6 | Pending |
| PLUGIN-06 | Phase 1 | Complete (01-04) |
| SHARED-01 | Phase 2 | Pending |
| SHARED-02 | Phase 2 | Pending |
| SHARED-03 | Phase 2 | Pending |
| SHARED-04 | Phase 2 | Pending |
| SHARED-05 | Phase 2 | Pending |
| INIT-01 | Phase 3 | Pending |
| INIT-02 | Phase 3 | Pending |
| INIT-03 | Phase 3 | Pending |
| INIT-04 | Phase 3 | Pending |
| INIT-05 | Phase 3 | Pending |
| INIT-06 | Phase 3 | Pending |
| CONTRACT-01 | Phase 4 | Pending |
| CONTRACT-02 | Phase 4 | Pending |
| CONTRACT-03 | Phase 4 | Pending |
| CONTRACT-04 | Phase 4 | Pending |
| CONTRACT-05 | Phase 4 | Pending |
| TEST-01 | Phase 4 | Pending |
| TEST-02 | Phase 4 | Pending |
| TEST-03 | Phase 4 | Pending |
| TEST-04 | Phase 4 | Pending |
| DEPLOY-01 | Phase 4 | Pending |
| DEPLOY-02 | Phase 4 | Pending |
| DEPLOY-03 | Phase 4 | Pending |
| DEPLOY-04 | Phase 4 | Pending |
| DEPLOY-05 | Phase 4 | Pending |
| FRONTEND-01 | Phase 4 | Pending |
| FRONTEND-02 | Phase 4 | Pending |
| FRONTEND-03 | Phase 4 | Pending |
| FRONTEND-04 | Phase 4 | Pending |
| EXAMPLE-01 | Phase 5 | Pending |
| EXAMPLE-02 | Phase 5 | Pending |
| EXAMPLE-03 | Phase 5 | Pending |
| EXAMPLE-04 | Phase 5 | Pending |
| EXAMPLE-05 | Phase 5 | Pending |
| DIST-01 | Phase 6 | Pending |
| DIST-02 | Phase 6 | Pending |
| DIST-03 | Phase 6 | Pending |
| DIST-04 | Phase 6 | Pending |
| DIST-05 | Phase 6 | Pending |
| DIST-06 | Phase 6 | Pending |
| DIST-07 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 41 (100%)
- Unmapped: 0

**Per-phase requirement counts:**
- Phase 1: 5 (PLUGIN-01,02,03,04,06)
- Phase 2: 5 (SHARED-01..05)
- Phase 3: 6 (INIT-01..06)
- Phase 4: 18 (CONTRACT-01..05, TEST-01..04, DEPLOY-01..05, FRONTEND-01..04)
- Phase 5: 5 (EXAMPLE-01..05)
- Phase 6: 8 (PLUGIN-05, DIST-01..07)
- Total: 41 ✓

---
*Requirements defined: 2026-05-03*
*Last updated: 2026-05-03 after roadmap creation (traceability filled)*
