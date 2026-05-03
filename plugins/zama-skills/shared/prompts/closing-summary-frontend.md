<!-- closing-summary-frontend.md
     Rendered after /zama-frontend finishes. Substituted via
     `renderClosingSummary('frontend', vars)` from skills/_lib/closing-summary.ts
     and transcluded into SKILL.md via `@sync:prompt:closing-summary-frontend`.
     Placeholder syntax: {{key}}. -->

## ✅ /zama-frontend complete — relayer-sdk wired

### Files generated

- **Encryption lib:** `{{libPath}}`
- **Decryption hook:** `{{hookPath}}` (4-state: `idle → requesting → decrypted → error`)
- **Encrypted input component:** `{{componentPath}}`

### Stack pinned

- `@zama-fhe/relayer-sdk@^0.4.2` (NOT deprecated `fhevmjs`)
- `ethers@^6.16.0` + typechain v6 — enforced (skill aborts on typechain v5)
- Wagmi shim: `{{withWagmi}}`

> context7 verified the SDK API against `/zama-ai/fhevm` and the `fhevm-react-template` — `initSDK()` + `createInstance({ ...SepoliaConfig, network: window.ethereum })` is the current pattern.

### You're ready to ship — `pnpm dev` to preview locally, then deploy to Vercel.
