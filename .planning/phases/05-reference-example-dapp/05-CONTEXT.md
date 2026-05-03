---
phase: 5
name: Reference Example dApp
gathered: 2026-05-03
status: Ready for planning
mode: Interactive discuss (4 user-answered questions + clarifying round)
---

# Phase 5: Reference Example dApp — Context

<domain>
## Phase Boundary

`examples/confidential-token/` — bir kez deploy edilen, hand-curated bir confidential ERC7984 token dApp. GitHub'a push'lanır, Vercel auto-deploys, README'de canlı URL + verified Sepolia kontrat adresi. Skill'lerin gerçek production-grade çıktı ürettiğini kanıtlar (dogfooding).

**Requirements (locked):**
- EXAMPLE-01: hand-curated, çalışan ConfFungible Token dApp
- EXAMPLE-02: Sepolia deploy + Etherscan verify + Confidential Token Registry kayıt
- EXAMPLE-03: Vercel canlı URL — gerçek encrypt + decrypt akışı
- EXAMPLE-04: `.gsd-snapshot.json` — provenance kaydı
- EXAMPLE-05: CI smoke-diff — taze skill çıktısı vs commit'lenen örnek

**Out of scope:** Mainnet deploy, audit-grade güvenlik, çok-zincirli destek, kullanıcı yönetimi, ENS, sign-in, bookmarking, comments, search/filter.
</domain>

<decisions>
## Implementation Decisions (LOCKED — user-confirmed)

### Token Contract Variant
**Stand-alone ERC7984 confidential token** (OZ ConfidentialFungibleToken). Confidential Token Registry'ye self-register. Wrapper / custom dışlandı (basitlik).

### Frontend Stack
**Next.js 15 (App Router) + shadcn/ui + 21st.dev (Magic MCP)** ile güzel tasarım. Vite dışlandı (Vercel + shadcn ekosistemi Next.js'te daha olgun).
- shadcn components: Button, Card, Input, Toast, Dialog, Skeleton — minimum.
- Magic MCP (`mcp__magic__*`) hero, balance card, transfer form için 21st.dev tarzı bileşenler üretecek.
- Tailwind CSS, dark mode default.

### dApp UX Scope (locked)
3 kullanıcı eylemi:
1. **Connect wallet + view encrypted balance** — wagmi + viem + RainbowKit. Balance handle → `useDecrypted` hook → 4-state UX (idle/requesting/decrypted/error).
2. **Mint to self (faucet)** — mint(amount) butonu; herkes 100 token mint edebilir (test için).
3. **Transfer to address** — recipient + amount input → encrypted input → contract.transfer.
- Burn / withdraw: deferred (zaman).

### Deploy Flow
- **Sepolia kontrat deploy:** Tek-kullanımlık cüzdan üretildi (`0xFa2961718AE286Fb31A9AeA908F7bDF3bB8237e7`), kullanıcı 0.3 Sepolia ETH yatırdı. Private key `.env.deploy.local`'de (gitignore). Ben `pnpm hardhat deploy --network sepolia` çalıştıracağım.
- **Etherscan verify:** `pnpm hardhat verify` ile otomatik post-deploy.
- **Confidential Token Registry:** Deploy script'in son adımı registry'ye self-register.
- **Vercel:** GitHub push → Vercel auto-deploys (kullanıcı Vercel'i repo'ya bağlar). Ben Vercel CLI çalıştırmıyorum.
- **Frontend env:** Vercel dashboard env vars (`NEXT_PUBLIC_CONTRACT_ADDRESS`, `NEXT_PUBLIC_SEPOLIA_RPC`, `NEXT_PUBLIC_RELAYER_URL`) + `examples/confidential-token/frontend/.env.local.example` repo'da.

### Dogfooding Constraint (LOCKED — REQUIREMENT EXAMPLE-01)
Örnek MUST be hand-curated from skill output. İş akışı:
1. `examples/confidential-token/` dizinini boş başlat.
2. `/zama-init` skill'ini çalıştır → temel scaffold.
3. `/zama-contract` skill'ini ERC7984 use-case'iyle çalıştır → `Token.sol`.
4. `/zama-test` → unit + sepolia testleri.
5. `/zama-deploy` → deploy + verify + register scripts.
6. `/zama-frontend` → fhe.ts + useDecrypted + EncryptedInput.
7. Üzerine: shadcn UI bileşenleri (Magic MCP ile) + Next.js sayfaları + 3 kullanıcı eylemi.
8. `.gsd-snapshot.json` oluştur (skill versiyonları + use-case kayıtlı).
9. Sepolia'ya deploy + verify + Vercel push.

Bu dogfooding hem requirement (EXAMPLE-01) hem de test — eğer skill'ler bozuksa burada ortaya çıkar.
</decisions>

<code_context>
## Existing Code (from prior phases)

- `plugins/zama-skills/skills/init/SKILL.md` (Phase 3) — `/zama-init` ready
- `plugins/zama-skills/skills/contract/` (Phase 4) — `/zama-contract` ready, ERC7984 template at `assets/templates/erc7984.sol.tpl`
- `plugins/zama-skills/skills/test/` (Phase 4) — `/zama-test` ready
- `plugins/zama-skills/skills/deploy/` (Phase 4) — `/zama-deploy` ready, `disable-model-invocation: true`
- `plugins/zama-skills/skills/frontend/` (Phase 4) — `/zama-frontend` ready, 4 templates
- `plugins/zama-skills/skills/_lib/` (Phase 4) — preflight + closing-summary helpers
- `scripts/validate.ts` (Phase 4) — `auditPhase4Skills` çalışıyor
- `.env.deploy.local` (Phase 5 prep) — tek-kullanımlık deploy cüzdanı (0.3 ETH)

## Patterns to Reuse

- TDD gate (RED → GREEN) Phase 4'te tüm planlarda kullanıldı — Phase 5'te de.
- Worktree-isolated parallel execution — Phase 5 plans paralel olabilir.
- Sync markers (`<!-- @sync:prompt:... -->`) — Phase 5 README'de skill çıktıları için kullanılabilir.
</code_context>

<canonical_refs>
## Canonical References (downstream agents MUST read)

- `.planning/PROJECT.md` — proje vizyonu, constraints
- `.planning/REQUIREMENTS.md` — EXAMPLE-01..05 + DIST-01 (README hero)
- `.planning/ROADMAP.md` Phase 5 success criteria
- `plugins/zama-skills/skills/contract/assets/templates/erc7984.sol.tpl` — kontrat template
- `plugins/zama-skills/skills/deploy/SKILL.md` — deploy 7-adım workflow
- `plugins/zama-skills/skills/frontend/assets/templates/` — fhe.ts, useDecrypted, EncryptedInput, fhe-wagmi
- `plugins/zama-skills/skills/_lib/closing-summary.ts` — README üretimi için
- `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` — runtime fetch (deploy script)
- `https://www.openzeppelin.com/confidential-contracts` — ERC7984 + ConfidentialFungibleToken
- shadcn/ui docs — `https://ui.shadcn.com`
- 21st.dev Magic MCP — `mcp__magic__*` araçları (component_builder, logo_search)
- Next.js 15 App Router — `https://nextjs.org/docs/app`
- wagmi v2 + viem — `https://wagmi.sh`

**MCP tools to use during implementation:**
- `mcp__context7__*` — fhEVM / OZ confidential / wagmi resmi docs
- `mcp__magic__21st_magic_component_builder` — shadcn-style components
- `mcp__claude-in-chrome__*` — UI smoke testing post-deploy
</canonical_refs>

<specifics>
## Specific Ideas

- README'de "Try it live" linki + GIF demo (90 sn).
- 4-state UX kullanıcıya görünmeli: balance kartında "Decrypting via relayer..." spinner şart.
- Hero section: "Confidential ERC7984 on Sepolia — encrypted balances, public transfers" + canlı kontrat adresi badge'i.
- Theme: dark mode default; Zama brand colors (siyah + sarı accent).
- Mobile responsive: judge mobil cihazdan da test edebilir.
- Loading skeleton: balance card için.
- Toast: tx submit / confirm / error.
- Connect button: RainbowKit (wagmi'nin recommended).
</specifics>

<deferred>
## Deferred Ideas (future phases / out of scope)

- Burn / withdraw — UX scope dışı bırakıldı.
- Multi-token support — başka bir milestone.
- ENS lookup for recipient — nice-to-have.
- Transaction history view — Phase 6+ veya v2.
- Mainnet deploy — Out of scope (PROJECT.md).
- ERC7984ERC20Wrapper variant — başka bir örnek (v2).
- Audit-grade reentrancy / formal verification — out of scope (testnet).
- Mobile-first PWA — kapsam genişletme; responsive yeter.
</deferred>
