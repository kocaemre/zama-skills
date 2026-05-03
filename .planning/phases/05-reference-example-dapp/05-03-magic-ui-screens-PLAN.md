---
phase: 05-reference-example-dapp
plan: 03
type: execute
wave: 3
depends_on: [02]
files_modified:
  - examples/confidential-token/packages/frontend/app/page.tsx
  - examples/confidential-token/packages/frontend/components/Hero.tsx
  - examples/confidential-token/packages/frontend/components/BalanceCard.tsx
  - examples/confidential-token/packages/frontend/components/MintButton.tsx
  - examples/confidential-token/packages/frontend/components/TransferForm.tsx
  - examples/confidential-token/packages/frontend/components/Connect.tsx
  - examples/confidential-token/packages/frontend/lib/contract.ts
  - examples/confidential-token/packages/frontend/lib/abi/Token.json
autonomous: true
requirements: [EXAMPLE-03]
must_haves:
  truths:
    - "Page shows: Hero (project pitch + verified-contract badge slot), Connect, BalanceCard, MintButton, TransferForm"
    - "BalanceCard exposes 4-state UX: idle / requesting / decrypted / error — driven by useDecrypted hook from /zama-frontend"
    - "MintButton calls Token.mint(100 * 10^decimals) for connected user (faucet)"
    - "TransferForm encrypts amount via EncryptedInput then calls Token.transfer(to, encryptedHandle, inputProof)"
    - "Toast (sonner) reports tx submit / confirm / error for both mint and transfer"
    - "All UI components are shadcn-based; design polish via mcp__magic__21st_magic_component_builder"
    - "Mobile responsive: layouts use Tailwind responsive classes; works at 375px width"
    - "BalanceCard uses Skeleton while requesting; never displays raw ciphertext to user"
  artifacts:
    - path: "examples/confidential-token/packages/frontend/app/page.tsx"
      provides: "Single-page app composing all UI components"
      contains: "BalanceCard"
    - path: "examples/confidential-token/packages/frontend/components/BalanceCard.tsx"
      provides: "Encrypted balance fetch + decrypt with 4-state UX"
      contains: "useDecrypted"
    - path: "examples/confidential-token/packages/frontend/components/MintButton.tsx"
      provides: "Faucet mint to self"
      contains: "writeContract"
    - path: "examples/confidential-token/packages/frontend/components/TransferForm.tsx"
      provides: "Recipient + encrypted amount transfer"
      contains: "EncryptedInput"
    - path: "examples/confidential-token/packages/frontend/lib/contract.ts"
      provides: "Typed contract address + ABI export"
      contains: "NEXT_PUBLIC_CONTRACT_ADDRESS"
  key_links:
    - from: "components/BalanceCard.tsx"
      to: "@zama/hooks/useDecrypted"
      via: "useDecrypted hook drives 4-state machine"
      pattern: "useDecrypted"
    - from: "components/TransferForm.tsx"
      to: "@zama/components/EncryptedInput"
      via: "wraps EncryptedInput for amount"
      pattern: "EncryptedInput"
    - from: "components/MintButton.tsx"
      to: "wagmi useWriteContract + lib/contract.ts ABI"
      via: "writeContract({address, abi, functionName: 'mint'})"
      pattern: "useWriteContract"
---

<objective>
Build the three user-facing screens (Hero, BalanceCard, MintButton, TransferForm) on top of the Plan 02 shell, using Magic MCP (21st.dev component builder) for visual polish. Wire each component to the /zama-frontend-produced primitives (`fhe.ts`, `useDecrypted`, `EncryptedInput`) and to wagmi v2 for tx submission.

Purpose: Delivers the locked 3-action UX (connect+view balance, mint, transfer). This is what a judge sees when they hit the Vercel URL.
Output: A polished single-page app that, once Plan 04 sets `NEXT_PUBLIC_CONTRACT_ADDRESS`, will work end-to-end on Sepolia.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-reference-example-dapp/05-CONTEXT.md
@CLAUDE.md
@plugins/zama-skills/skills/frontend/assets/templates/useDecrypted.ts.tpl
@plugins/zama-skills/skills/frontend/assets/templates/EncryptedInput.tsx.tpl
@plugins/zama-skills/skills/frontend/assets/templates/fhe-wagmi.ts.tpl

<interfaces>
Imports from /zama-frontend output (via `@zama/*` alias from Plan 02):
- `import { fhe } from '@zama/lib/fhe'` — relayer SDK singleton (lazy init promise)
- `import { useDecrypted } from '@zama/hooks/useDecrypted'` — `{ state, value, error, request }` where state ∈ `'idle'|'requesting'|'decrypted'|'error'`
- `import { EncryptedInput } from '@zama/components/EncryptedInput'` — bounds-checked controlled input that emits `{ handle, proof }` on blur

Token ABI (4 functions consumed):
```
balanceOf(address) → euint64 handle
mint(uint64 amount)            // faucet — anyone, capped 100 per call
transfer(address to, externalEuint64 amount, bytes inputProof) → ebool
decimals() → uint8
```
ABI JSON lives at `lib/abi/Token.json` — copied from `examples/confidential-token/packages/contracts/artifacts/contracts/Token.sol/Token.json` `abi` field at build time. (Plan 04 will keep this in sync after deploy via a small `pnpm sync-abi` script — for THIS plan, hand-copy the ABI from the Plan 01 compile output.)

Contract address resolution: `lib/contract.ts` exports `TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`)` — typed as `0x${string}` so wagmi accepts it. Throws helpful error in dev if unset.

4-state UX per BalanceCard:
- `idle`: shows "Click to decrypt" pill button
- `requesting`: Skeleton + caption "Decrypting via relayer..."
- `decrypted`: large number + "Refresh" button
- `error`: red text + retry

Magic MCP usage: For each of Hero, BalanceCard, MintButton, TransferForm, call `mcp__magic__21st_magic_component_builder` with a precise design brief. Take the returned JSX as a starting point, then wire to the wagmi/fhe hooks. Do NOT accept Magic MCP output verbatim — it does not know the contract — but use it for visual structure, spacing, and microcopy.

Brand: dark mode default; Zama yellow (#FFD500) for primary CTAs; black background; subtle yellow glow on the verified-contract badge in Hero.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Hero + Connect + BalanceCard with 4-state UX</name>
  <files>examples/confidential-token/packages/frontend/components/{Hero,Connect,BalanceCard}.tsx, examples/confidential-token/packages/frontend/lib/contract.ts, examples/confidential-token/packages/frontend/lib/abi/Token.json, examples/confidential-token/packages/frontend/app/page.tsx</files>
  <action>
1. `lib/contract.ts`: export `TOKEN_ADDRESS` (typed `0x${string}` from env) + `TOKEN_ABI` (imported from `./abi/Token.json`). Throw a dev-only error with message "Run /zama-deploy or set NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local" if address is missing.
2. `lib/abi/Token.json`: copy the `abi` array from `packages/contracts/artifacts/contracts/Token.sol/Token.json` (compile produced this in Plan 01). Commit only the ABI, not the full artifact.
3. `components/Hero.tsx`:
   - Call `mcp__magic__21st_magic_component_builder` with brief: "Dark hero section, full-width, Zama yellow accent. Headline: 'Confidential ERC7984 on Sepolia'. Subheadline: 'Encrypted balances. Public transfers. Powered by fhEVM.' Right side: badge linking to Etherscan with the verified contract address — yellow glow. Mobile-stack at 768px."
   - Take the returned JSX, wire the Etherscan link to `https://sepolia.etherscan.io/address/${TOKEN_ADDRESS}`, hide badge if address unset.
4. `components/Connect.tsx`: replace Plan 02 stub — wraps RainbowKit `<ConnectButton showBalance={false} chainStatus="icon" />`. No Magic MCP needed.
5. `components/BalanceCard.tsx` (the showpiece):
   - `'use client'`. Uses `useAccount()` from wagmi to get address.
   - Uses `useReadContract({ address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: 'balanceOf', args: [address] })` to get the encrypted handle.
   - Pipes the handle into `useDecrypted(handle)` — gets `{state, value, error, request}`.
   - Renders per state map in `<interfaces>`: idle → CTA button calling `request()`; requesting → Skeleton + caption; decrypted → format `value` with decimals (default 6) using `formatUnits` from viem; error → red + Retry.
   - Use Magic MCP to design the card shell first ("dark Card with yellow accent border on hover, large numeric display, subtle relayer-icon micro-animation while decrypting").
6. `app/page.tsx`: layout `<main>` with `<Hero />`, `<div className="container mx-auto py-8 grid gap-6 md:grid-cols-2"><Connect /><BalanceCard /></div>`. (Mint + Transfer arrive in Task 2.)
7. Verify build + visual smoke: `pnpm --filter frontend build`, then `pnpm --filter frontend dev` and load http://localhost:3000 (no env, dev-only) — page renders with helpful "set NEXT_PUBLIC_CONTRACT_ADDRESS" message in BalanceCard.
8. Commit: `feat(05): hero + balance card with 4-state UX`.
  </action>
  <verify>
    <automated>cd examples/confidential-token/packages/frontend && pnpm build && grep -q "useDecrypted" components/BalanceCard.tsx && grep -q "Skeleton" components/BalanceCard.tsx && grep -q "TOKEN_ADDRESS" lib/contract.ts && test -f lib/abi/Token.json && node -e "const a=require('./lib/abi/Token.json'); if (!Array.isArray(a) || !a.find(x=>x.name==='balanceOf')) process.exit(1)"</automated>
  </verify>
  <done>Hero renders; BalanceCard shows correct state for each of {no-address, address+no-handle, requesting, decrypted, error}; build green.</done>
</task>

<task type="auto">
  <name>Task 2: MintButton + TransferForm with toast UX</name>
  <files>examples/confidential-token/packages/frontend/components/{MintButton,TransferForm}.tsx, examples/confidential-token/packages/frontend/app/page.tsx</files>
  <action>
1. `components/MintButton.tsx`:
   - `'use client'`. Magic MCP brief: "Big yellow CTA button — 'Mint 100 cDEMO to me' — pulses subtly. Disabled when no wallet."
   - Wire `useWriteContract()` from wagmi: `writeContract({ address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: 'mint', args: [100n * 10n ** 6n] })` (6 decimals from /zama-contract metadata).
   - On submit: `toast.loading('Minting…')`. On hash: `toast.success('Tx submitted', { description: <a href={...etherscan} /> })`. Await `useWaitForTransactionReceipt`; on confirm: `toast.success('100 cDEMO minted to you')`. On error: `toast.error(err.shortMessage ?? err.message)`.
   - Trigger BalanceCard refresh by exposing a context or calling `queryClient.invalidateQueries({ queryKey: ['readContract'] })` after confirm.
2. `components/TransferForm.tsx`:
   - Magic MCP brief: "Compact form Card — recipient address input + amount input + 'Send confidentially' button. Dark theme, yellow accent. Inline validation: bad address shows red helper text."
   - Form state: `{ to: '', amount: '' }`. On amount blur, call `<EncryptedInput />` from /zama-frontend (it returns `{ handle, proof }` via callback).
   - Validate `to` with viem `isAddress`. Validate `amount` > 0.
   - On submit: call `Token.transfer(to, handle, proof)` via `useWriteContract`. Same toast lifecycle as MintButton (loading → submitted → confirmed → invalidate balance query).
3. Update `app/page.tsx` to a 2-column grid below Hero:
   ```
   <Hero />
   <main className="container mx-auto py-8 grid gap-6 md:grid-cols-2">
     <div className="space-y-6">
       <Connect />
       <BalanceCard />
     </div>
     <div className="space-y-6">
       <MintButton />
       <TransferForm />
     </div>
   </main>
   ```
4. Mobile pass: ensure all four cards stack on `<md:` widths; test at 375px in browser dev tools (devtools-only, document in commit message).
5. Verify: `pnpm --filter frontend build` exits 0; tsc strict mode passes (next 15 default).
6. Commit: `feat(05): mint button + transfer form with sonner toast UX`.
  </action>
  <verify>
    <automated>cd examples/confidential-token/packages/frontend && pnpm build && grep -q "useWriteContract" components/MintButton.tsx && grep -q "EncryptedInput" components/TransferForm.tsx && grep -q "isAddress" components/TransferForm.tsx && grep -q "MintButton" app/page.tsx && grep -q "TransferForm" app/page.tsx</automated>
  </verify>
  <done>Build + tsc green; all three actions present in page; toast lifecycle wired for both write txs; mobile stacks correctly.</done>
</task>

</tasks>

<verification>
1. `pnpm --filter frontend build` succeeds.
2. With `NEXT_PUBLIC_CONTRACT_ADDRESS` unset, page renders helpful messages instead of crashing.
3. With env set (Plan 04 will populate), MintButton and TransferForm submit txs and trigger balance refresh.
4. /zama-frontend primitives (`fhe.ts`, `useDecrypted`, `EncryptedInput`) imported via `@zama/*` — no copy-paste duplication.
5. Mobile layout works at 375px.
</verification>

<success_criteria>
- 3 locked user actions delivered (connect+view balance, mint, transfer)
- 4-state decryption UX visible on BalanceCard
- Toast lifecycle on every write tx
- Magic MCP used for all four major UI components — design polish, not a stock shadcn sample
- Mobile responsive
</success_criteria>

<output>
Create `.planning/phases/05-reference-example-dapp/05-03-SUMMARY.md` listing: components built, Magic MCP prompts used (verbatim), state-machine implementation notes, mobile breakpoints tested.
</output>
