# zama-skills

## What This Is

Zama Protocol (fhEVM) ile inşa eden geliştiriciler için bir AI agent skill paketi. Claude Code skills (birincil) + her AI agent için kopyalanabilir markdown rehberler (ikincil) — boş bir dizinden çalışan bir confidential dApp'e 30 dakikada götürür. Zama Developer Program Mainnet Season 2 — Bounty Track submission'ı.

## Core Value

Bir geliştirici Claude Code'da `/zama-init` yazdığında, FHE bilgisi olmadan bile, çalışan ve deploy edilmiş bir confidential dApp ile sohbeti bitirebilmeli. Skill'ler context7 üzerinden resmi Zama dokümantasyonunu canlı sorguladığı için hallucination yok — üretilen her satır resmi pattern'lerden doğrulanmış.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **Ana skill `/zama-init`** — fhevm-react-template'i fork eder, kullanıcının use-case'ini sorar (token / voting / auction / custom), contract+frontend'i özelleştirip çalışır halde teslim eder
- [ ] **`/zama-contract`** — confidential contract yazma asistanı: `euint`, `TFHE`, ACL pattern'leri ve OpenZeppelin Confidential Contracts'ı doğru kullanır
- [ ] **`/zama-test`** — FHE test pattern'leri: encrypted input mocking, decrypt assertion helper'ları, Hardhat fhEVM plugin entegrasyonu
- [ ] **`/zama-deploy`** — Sepolia testnet'e deploy + Confidential Token Registry kaydı
- [ ] **`/zama-frontend`** — React + FHE.js entegrasyonu: encrypted input UI, decrypt display pattern'leri
- [ ] **Context7-aware orchestration** — Tüm skill'ler her cevap öncesi `/zama-ai/fhevm`, `/zama-ai/fhevm-hardhat-template` ve `/websites/openzeppelin_confidential-contracts` kaynaklarını sorgular; pattern'leri doğrudan resmi kaynaktan çeker
- [ ] **Generic markdown rehberler** — Her skill için `.cursorrules` / generic AI agent kullanıcılarının kopyalayabileceği markdown rehber muadili
- [ ] **GitHub repo + npm package** — `npx zama-skills install` ile tek komutta kurulum; README'de tek tıkla install gösterimi
- [ ] **Cilalı README + örnek dApp** — En az bir tam çalışan örnek (confidential token deploy edilmiş + frontend live)

### Out of Scope

- **Kendi MCP server inşa etmek** — Context7'de fhEVM (1772 snippet, High reputation), fhevm-hardhat-template ve OpenZeppelin Confidential Contracts zaten mevcut; reinvent etmenin değeri yok
- **`/zama-audit` (FHE-aware code review)** — v2'ye ertelendi: orta seviye FHE deneyimiyle 7 günde "exceptional" kalitede review skill'i yapmak risk; ana scope'u zayıflatır
- **`/zama-debug` (FHE hata teşhisi)** — v2'ye ertelendi: aynı sebep, scope/risk dengesi
- **Cursor için native `.cursorrules` formatı** — Generic markdown ile dolaylı destek var; native Cursor entegrasyonu submission sonrası
- **Mainnet deploy desteği** — v1 sadece Sepolia testnet; mainnet ek auditing/risk gerektirir

## Context

**Bounty Track:** Zama Developer Program Mainnet Season 2. Tema: "AI agent skills for building with the Zama Protocol." Ödül havuzu 3,000 cUSDT (1500/1000/500), tek bir submission "exceptional quality" görülürse tamamı tek başvuruya verilebilir. Deadline 2026-05-10 23:59 AOE (~7 gün).

**Resmi kaynaklar (Zama tarafından önerilen):**
- Quick Start Tutorial – Solidity Guides: https://docs.zama.org/protocol/solidity-guides/getting-started/quick-start-tutorial
- React dApp Template + Hardhat: https://github.com/zama-ai/fhevm-react-template
- OpenZeppelin Confidential Contracts: https://github.com/OpenZeppelin/openzeppelin-confidential-contracts
- FHEVM Examples: https://docs.zama.org/protocol/examples/
- Sepolia Testnet Confidential Token Registry: https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia

**Geliştirici profili:** Solo developer, Claude Code + GSD workflow ile her gün skill yazıyor (yani "skill paketleme" konusunda ekspertiz var). Zama/fhEVM deneyimi orta — birkaç confidential contract yazmış, `euint` / encrypted input / ACL temellerine hakim, ama production deneyim yok.

**Stratejik avantaj:** Submitter zaten Claude Code skill ekosistemini derinden biliyor — bu, "AI agent skills for X" kategorisinde yapısal bir avantaj.

## Constraints

- **Timeline**: 7 gün (2026-05-03 → 2026-05-10) — çok sıkı; her ekstra feature kalite trade-off'u yaratır
- **Tech stack**: TypeScript / Node.js (npm package), Markdown (Claude Code skills format), Solidity (örnek contracts), React (örnek frontend)
- **Dependencies**: fhEVM resmi paketleri, Hardhat fhEVM plugin, OpenZeppelin Confidential Contracts, FHE.js (frontend), context7 MCP (orchestration)
- **Compatibility**: Claude Code (skills + agents + slash commands); generic markdown rehberler diğer AI tool'lar için
- **Network**: Sadece Sepolia testnet (mainnet v1'de yok)
- **Submission**: GitHub repo URL'si + npm package; cilalı README (jüri büyük ihtimalle önce burayı görür)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Kendi MCP server yerine context7 kullan | Context7'de Zama'nın 3 high-reputation kaynağı zaten var (1772+43+354 snippet); reinvent gereksiz, hallucination'a karşı aynı korumayı veriyor | — Pending |
| fhevm-react-template fork + customize (sıfırdan scaffold yerine) | Resmi doc Zama'nın kendisi tarafından öneriliyor, "best practice" olarak konumlanıyor; kendi scaffold'umuz wheel-reinvent görünür | — Pending |
| Audit + Debug skill'lerini v2'ye ertele | Orta seviye FHE deneyimiyle 7 günde derin audit yazmak risk; ana scope'u zayıflatır | — Pending |
| Claude Code primary, generic markdown secondary (Cursor'a özel format yok) | 3 platforma da iyi entegrasyon = hepsinde yüzeysel; Claude'da derinlik + diğerlerine kopyalanabilir köprü daha gerçekçi | — Pending |
| Differentiator = "context7-aware skills" (anti-hallucination) | Diğer submission'larda yüksek ihtimalle yok; somut, gösterilebilir bir teknik avantaj | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-03 after initialization*
