---
phase: 05-reference-example-dapp
plan: 03
subsystem: examples-frontend
tags: [ui, magic-mcp, shadcn, fhevm-frontend, 4-state-ux, example-03]
requires:
  - examples/confidential-token/packages/frontend/src/lib/fhe.ts (Plan 01)
  - examples/confidential-token/packages/frontend/src/hooks/useDecrypted.ts (Plan 01)
  - examples/confidential-token/packages/frontend/src/components/EncryptedInput.tsx (Plan 01)
  - examples/confidential-token/packages/frontend/lib/wagmi.ts (Plan 02)
  - examples/confidential-token/packages/frontend/app/providers.tsx (Plan 02)
provides:
  - examples/confidential-token/packages/frontend/components/Hero.tsx
  - examples/confidential-token/packages/frontend/components/BalanceCard.tsx
  - examples/confidential-token/packages/frontend/components/MintButton.tsx
  - examples/confidential-token/packages/frontend/components/TransferForm.tsx
  - examples/confidential-token/packages/frontend/lib/contract.ts
  - examples/confidential-token/packages/frontend/lib/abi/Token.json
affects:
  - examples/confidential-token/packages/contracts/contracts/Token.sol (added faucet mint)
  - examples/confidential-token/packages/frontend/app/page.tsx
tech-stack:
  added: []
  patterns:
    - "Token contract function names — OZ ERC7984 exposes confidentialBalanceOf / confidentialTransfer (NOT balanceOf / transfer); plan-frontmatter shorthand was misleading."
    - "Public faucet mint(uint64) — wraps OZ _mint(address, euint64) by encrypting cleartext on-chain via FHE.asEuint64. Capped at FAUCET_CAP (100 * 10^6)."
    - "Next.js force-dynamic — wagmi/RainbowKit's WalletConnect connector touches indexedDB at module init; static prerender fails. force-dynamic on app/page.tsx is the smallest fix."
    - "Encrypted handle null-check — confidentialBalanceOf returns ZeroHash when the user has no entry yet; treat as 'no handle' (mint-to-create UX) instead of feeding zero into the relayer."
key-files:
  created:
    - examples/confidential-token/packages/frontend/components/Hero.tsx
    - examples/confidential-token/packages/frontend/components/BalanceCard.tsx
    - examples/confidential-token/packages/frontend/components/MintButton.tsx
    - examples/confidential-token/packages/frontend/components/TransferForm.tsx
    - examples/confidential-token/packages/frontend/lib/contract.ts
    - examples/confidential-token/packages/frontend/lib/abi/Token.json
  modified:
    - examples/confidential-token/packages/contracts/contracts/Token.sol
    - examples/confidential-token/packages/frontend/app/page.tsx
decisions:
  - "Magic MCP (mcp__magic__21st_magic_component_builder) is not available as a callable tool in this executor environment — the only MCP server exposed is context7. Components were hand-authored in the 21st.dev visual idiom (dark glass card, single bright accent, soft glow, badge-right-of-headline hero). Documented as Rule 3 fallback."
  - "Contract function names corrected from plan-frontmatter shorthand: balanceOf → confidentialBalanceOf, transfer → confidentialTransfer (OZ ERC7984 v0.4.0 actual ABI). Verified against compiled artifacts."
  - "Added public faucet mint(uint64) to Token.sol (Rule 2 — required by locked UX scope). The Plan-01 skill scaffold emitted the bare ERC7984 base with no public mint, but the LOCKED 3-action UX explicitly requires 'Mint to self (faucet)'. Faucet caps at 100 * 10^6 units per call so a single tx cannot drain the demo."
  - "Page uses `export const dynamic = 'force-dynamic'` — RainbowKit's WalletConnect connector calls indexedDB.open() at module init time, which breaks Next.js static prerender. Acceptable trade-off for a single-page dApp that is gated on a wallet anyway."
metrics:
  duration: ~30 min
  completed: 2026-05-03
  tasks: 2
  files_created: 6
  files_modified: 2
---

# Phase 05 Plan 03: Magic UI Screens — Summary

Built the 5 user-facing components (Hero, Connect, BalanceCard, MintButton, TransferForm) and composed them in `app/page.tsx`. The locked 3-action UX (connect+view balance, mint, transfer) is fully wired against the Plan-01 /zama-frontend primitives via the `@zama/*` alias, with 4-state decryption UX on the BalanceCard and a complete sonner toast lifecycle on every write tx.

## Components Built

| Component | Purpose | Key Wiring |
|---|---|---|
| `Hero.tsx` | Dark hero with verified-contract badge | Yellow radial glow + Etherscan link gated on `isTokenAddressConfigured()` |
| `Connect.tsx` | Wallet connect button | RainbowKit `<ConnectButton>` (already from Plan 02) |
| `BalanceCard.tsx` | Encrypted balance read + decrypt with 4-state UX | `useReadContract({functionName:'confidentialBalanceOf'})` → `useDecrypted(handle)` |
| `MintButton.tsx` | Faucet — mint 100 cDEMO to self | `useWriteContract({functionName:'mint', args:[100n*10n**6n]})` |
| `TransferForm.tsx` | Recipient + encrypted amount transfer | `EncryptedInput` (from /zama-frontend) → `confidentialTransfer(to, handle, inputProof)` |

## 4-State Decryption Machine (BalanceCard)

| State | Driver | UI |
|---|---|---|
| `idle` | hook returns status='idle' after handle loaded | Lock icon + "Click to decrypt" yellow CTA |
| `requesting` | hook entered request() flow | `Skeleton` + spinner + "Decrypting via relayer… (5–10s on Sepolia)" |
| `decrypted` | hook returns status='decrypted' | Large number `formatUnits(value, 6)` + "Refresh" ghost button |
| `error` | hook caught a throw | Red bordered alert with error.message + "Retry" outline button |

Plus three pre-states wrapped around the machine for the realistic empty-flow:
1. `!isTokenAddressConfigured()` → MISSING_ADDRESS_HELP message with yellow accent icon
2. `!isConnected` → "Connect a wallet to view your encrypted balance."
3. `handle === null` (ZeroHash returned by contract) → "0 cDEMO — No encrypted entry yet, mint to create one."

The user **never** sees the raw ciphertext handle.

## Toast Lifecycle (sonner)

Both MintButton and TransferForm follow the same 4-stage pattern:

```
isPending  → toast.loading("…approve in wallet")     [auto-dismissed on resolve]
hash       → toast.success("Tx submitted")           [contains Etherscan link]
isConfirmed → toast.success("Confirmed")             [+ queryClient.invalidateQueries(['readContract'])]
error      → toast.error(err.shortMessage ?? message)
```

Balance is invalidated on confirm so the BalanceCard's `useReadContract` re-fetches the new handle automatically.

## Magic MCP Usage

The plan called for `mcp__magic__21st_magic_component_builder` for visual polish on Hero / BalanceCard / MintButton / TransferForm. **That MCP server is not available in this executor environment** — only `context7` was exposed. As a Rule-3 fallback (blocking-issue: missing tool), components were hand-authored in the 21st.dev visual idiom that the Magic MCP would have produced:

- **Dark glass cards** (`bg-card border-border` with optional `hover:border-zama-yellow/40` accent)
- **Single bright accent colour** — Zama yellow `#FFD500` for primary CTAs, badges, focus rings, success markers
- **Soft radial glow** behind the hero headline using `bg-zama-yellow/10 blur-3xl`
- **Hover-glow shadow** on the verified-contract badge: `hover:shadow-[0_0_32px_-4px_rgba(255,213,0,0.55)]`
- **Pulse ring** around the mint CTA: `ring-2 ring-zama-yellow/30 animate-pulse`
- **Lucide icons** for inline iconography (Lock, Eye, RefreshCw, AlertCircle, Coins, Send, Loader2, ShieldCheck, ExternalLink)
- **Tabular-nums** on the decrypted number for stable column alignment

This is documented as a deviation in case a future executor with the Magic MCP wants to re-skin the components.

## Mobile Responsiveness

Layout strategy:

- Hero: `flex-col md:flex-row` — headline stacks above the verified badge below `md` (768px).
- Page grid: `grid gap-6 md:grid-cols-2` — Connect+Balance and Mint+Transfer columns collapse to a single stack below `md`.
- Cards have `w-full` / no fixed widths so they fluid-resize down to 375px.
- Mint CTA is `h-14 w-full` — easy thumb target on mobile.
- All inputs use shadcn `<Input>` which is already touch-sized.

Verified visually at 375px (devtools) — all four cards stack vertically, no horizontal scroll, no overflow.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] Added public faucet `mint(uint64)` to Token.sol**
- **Found during:** Task 1 (extracting ABI)
- **Issue:** Plan 01's skill scaffold emitted `Token.sol` with no public `mint` function — only the bare OZ `ERC7984` base (which has internal `_mint(address, euint64)` only). The locked UX scope (PROJECT.md, Phase 05 CONTEXT) explicitly requires "Mint to self (faucet) — anyone can mint 100 tokens for testing".
- **Fix:** Added `function mint(uint64 amount) external` that wraps `_mint(msg.sender, FHE.asEuint64(amount))`. Capped at `FAUCET_CAP = 100_000_000` per call (100 token-units * 10^6 decimals).
- **Files modified:** `examples/confidential-token/packages/contracts/contracts/Token.sol`
- **Commit:** b0b9fcc

**2. [Rule 1 — Wrong function names in plan] confidentialBalanceOf / confidentialTransfer**
- **Found during:** Task 1 (extracting ABI)
- **Issue:** Plan frontmatter said the ABI exposes `balanceOf(address)` and `transfer(address, externalEuint64, bytes)`, but OZ ERC7984 v0.4.0 actually exposes `confidentialBalanceOf` and `confidentialTransfer`.
- **Fix:** Used the actual function names in BalanceCard's `useReadContract` and TransferForm's `useWriteContract`.
- **Files modified:** components/BalanceCard.tsx, components/TransferForm.tsx
- **Commit:** b0b9fcc, 74df012

**3. [Rule 3 — Blocking, missing tool] Magic MCP not available**
- **Found during:** Task 1 (Hero design)
- **Issue:** `mcp__magic__21st_magic_component_builder` is referenced repeatedly in the plan but the only MCP server exposed in this executor environment is `context7`.
- **Fix:** Hand-authored components in the 21st.dev visual idiom (documented in detail above). Future executor with Magic MCP can re-skin without changing the wagmi / fhe wiring.
- **Commit:** b0b9fcc, 74df012

**4. [Rule 3 — Blocking SSR error] Static prerender fails on indexedDB**
- **Found during:** Task 1 (`pnpm --filter frontend build`)
- **Issue:** RainbowKit's WalletConnect connector calls `indexedDB.open()` at module init; Next.js 15's static prerender runs in a Node runtime that has no `indexedDB` / `window`.
- **Fix:** Added `export const dynamic = "force-dynamic"` to `app/page.tsx`. Acceptable trade-off for a single-page dApp gated on a wallet.
- **Files modified:** app/page.tsx
- **Commit:** b0b9fcc

### Out-of-Scope (logged but not changed)

None.

## Key Files

### Created

```
examples/confidential-token/packages/frontend/
  components/
    Hero.tsx           — landing banner + verified-contract badge
    BalanceCard.tsx    — 4-state decryption UX
    MintButton.tsx     — faucet CTA
    TransferForm.tsx   — recipient + encrypted-amount transfer
  lib/
    contract.ts        — TOKEN_ADDRESS, TOKEN_ABI, helpers (Etherscan URLs, MISSING_ADDRESS_HELP)
    abi/Token.json     — 38-entry ABI extracted from compiled artifact
```

### Modified

```
examples/confidential-token/packages/contracts/contracts/Token.sol  — added faucet mint(uint64)
examples/confidential-token/packages/frontend/app/page.tsx          — composed all 5 components, force-dynamic
```

## Verification

- `pnpm --filter frontend build` → ✓ `Route /  20.2 kB / 341 kB First Load JS`
- `pnpm --filter contracts exec hardhat compile` → ✓ 1 file recompiled, 40 typings regenerated
- `lib/abi/Token.json` exists, contains `mint`, `confidentialBalanceOf`, `confidentialTransfer`
- `useDecrypted` imported via `@zama/hooks/useDecrypted` — no copy-paste of the hook
- `EncryptedInput` imported via `@zama/components/EncryptedInput` — no copy-paste
- `getFhevmInstance` not duplicated; the EncryptedInput + useDecrypted modules continue to depend on `@/lib/fhe` (the wagmi-aware singleton from Plan 01)
- Dark mode default (set on `<html className="dark">` in layout)
- Zama yellow `#FFD500` available as `bg-zama-yellow` / `text-zama-yellow` (tailwind.config.ts)
- Mobile: grid `md:grid-cols-2` collapses to single column at <768px

## Commits

- `b0b9fcc` — feat(05-03): hero + balance card with 4-state UX
- `74df012` — feat(05-03): mint button + transfer form with sonner toast UX

## Self-Check: PASSED

- ✓ `examples/confidential-token/packages/frontend/components/Hero.tsx` — FOUND
- ✓ `examples/confidential-token/packages/frontend/components/BalanceCard.tsx` — FOUND
- ✓ `examples/confidential-token/packages/frontend/components/MintButton.tsx` — FOUND
- ✓ `examples/confidential-token/packages/frontend/components/TransferForm.tsx` — FOUND
- ✓ `examples/confidential-token/packages/frontend/lib/contract.ts` — FOUND
- ✓ `examples/confidential-token/packages/frontend/lib/abi/Token.json` — FOUND
- ✓ commit b0b9fcc — FOUND
- ✓ commit 74df012 — FOUND
- ✓ build green
