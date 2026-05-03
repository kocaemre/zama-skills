---
phase: 03-zama-init-end-to-end
plan: 03
subsystem: init-skill-seeds
tags: [fhevm, solidity, erc7984, acl, seeds]
requires: ["@fhevm/solidity@^0.11.1", "@openzeppelin/confidential-contracts@^0.4.0"]
provides: [confidential-token-seed, voting-seed, auction-seed, custom-seed]
affects: [/zama-init use-case branching]
key-files:
  created:
    - plugins/zama-skills/skills/init/assets/seeds/confidential-token/Token.sol
    - plugins/zama-skills/skills/init/assets/seeds/confidential-token/scripts/register-token.ts
    - plugins/zama-skills/skills/init/assets/seeds/voting/Poll.sol
    - plugins/zama-skills/skills/init/assets/seeds/auction/SealedBidAuction.sol
    - plugins/zama-skills/skills/init/assets/seeds/custom/Skeleton.sol
decisions:
  - "Poll.sol: VotesConfidential abstract — fallback to hand-rolled euint64 tally (compile-clean, standalone)"
  - "Token.sol: ERC7984 + ERC7984ERC20Wrapper (wrapper ctor is internal; pass name/symbol/uri via ERC7984)"
  - "SealedBidAuction: custom FHE.gt + FHE.select + FHE.asEaddress per Zama auction tutorial"
metrics:
  completed: 2026-05-03
  tasks: 2
  files: 5
---

# Phase 3 Plan 03: Seed Contracts Summary

4 use-case için minimum-viable Solidity seed'ler + deferred register script.

## Dosyalar

| Seed | Birincil import | OZ primitive vs fallback |
|------|-----------------|--------------------------|
| `confidential-token/Token.sol` | `ERC7984ERC20Wrapper` + `ERC7984` | OZ primitive kullanıldı |
| `voting/Poll.sol` | `@fhevm/solidity/lib/FHE.sol` | `VotesConfidential` fallback'e geçildi (abstract + ağır wiring) — euint64 tally |
| `auction/SealedBidAuction.sol` | `@fhevm/solidity/lib/FHE.sol` | OZ primitive yok — custom `FHE.gt` + `FHE.select` + `FHE.asEaddress` |
| `custom/Skeleton.sol` | `@fhevm/solidity/lib/FHE.sol` | Boş skeleton + deprecation-guard banner |

## ACL grants (kanıt: her state-write sonrası)

- **Token**: `mintConfidential` → `FHE.allowThis(amount)` + `FHE.allow(amount, msg.sender)`
- **Poll**: `createPoll`/`vote` → `FHE.allowThis(yesTally)` + `FHE.allowThis(noTally)`; `publishResults` → `FHE.makePubliclyDecryptable`
- **SealedBidAuction**: `bid` → `FHE.allowThis(highestBid/highestBidder)`; `settle` → `FHE.allow(.., msg.sender)` + `FHE.makePubliclyDecryptable(highestBidder)`
- **Skeleton**: `_storeExample` → `FHE.allowThis(_example)` + `FHE.allow(_example, msg.sender)`

## Context7 sorguları (yetkilendirme zamanı)

- `/websites/openzeppelin_confidential-contracts` — `ERC7984ERC20Wrapper` ctor (internal) + `ERC7984(name,symbol,contractURI)` ctor
- `/websites/openzeppelin_confidential-contracts` — `VotesConfidential` (abstract; `_getVotingUnits` + clock zorunlu → fallback)
- `/zama-ai/fhevm` — auction pattern: `FHE.lt`/`gt` + `FHE.select` + `FHE.asEaddress(msg.sender)`

## Deviations

- **Voting**: `VotesConfidential` planlanmıştı; standalone-compile için minimal euint64 tally fallback'ine geçildi. Yorumlarla `/zama-contract` aşamasında upgrade yolu belgelendi.
- Plan başka deviation gerektirmedi.

## Commits

- `0522900` feat(03-03): confidential-token seed + deferred register script
- `1ff3ad1` feat(03-03): voting + auction + custom seeds with ACL grants

## Self-Check: PASSED

- 5/5 dosya mevcut
- Tüm `.sol` dosyaları `@fhevm/solidity` import ediyor ve `FHE.allowThis` çağırıyor
- `import.*fhevmjs` veya `import.*"fhevm/"` eşleşmesi yok
- Skeleton.sol deprecation-guard banner içeriyor
- Commit hash'leri `git log` ile doğrulandı
