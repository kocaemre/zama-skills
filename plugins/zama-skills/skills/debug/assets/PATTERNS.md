# /zama-debug — Pattern Catalog

Patterns registered: **14**

This catalog is the human-readable mirror of `scripts/lib/patterns.ts`. CI
asserts that every entry in `patterns.ts` has a matching `### <name>`
heading here — keep both files in lockstep when adding patterns.

Each entry: regex hint → likely cause → concrete fix → reference.

---

### acl-not-allowed

**Trigger:** `revert ACL: not allowed` / `ACLNotAllowed` / `allowed() returned false`

**Cause:** Missing `FHE.allowThis(handle)` after a state-write of an encrypted value, or missing `FHE.allow(handle, msg.sender)` before returning the handle to a user.

**Fix:**
1. Add `FHE.allowThis(handle);` immediately after the assignment.
2. If user-decrypt is intended, also add `FHE.allow(handle, msg.sender);` before returning.
3. `npx hardhat compile` and re-run.

**Reference:** context7 `/zama-ai/fhevm` `topic=acl`

---

### relayer-sdk-init-undefined

**Trigger:** `TypeError: Cannot read properties of undefined (reading 'initSDK')`

**Cause:** Two common cases: (a) loaded the SDK as a UMD `<script>` and called `window.fhevm.initSDK` before the tag finished evaluating; (b) Next.js / Remix SSR evaluates the SDK import on the server, where `initSDK` is undefined.

**Fix:**
1. Use the canonical browser ESM entry: `import { initSDK, createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/bundle"` (or bare `@zama-fhe/relayer-sdk`).
2. Wrap init in `useEffect`, or guard with `typeof window !== "undefined"`. For Next.js, mark the file `"use client"`.
3. `rm -rf node_modules/.vite && npm run dev`.

**Reference:** https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer/initialization

---

### deprecated-fhevmjs

**Trigger:** `Module not found: 'fhevmjs'`

**Cause:** `fhevmjs` was officially deprecated 2025-07-10. Replacement is `@zama-fhe/relayer-sdk@^0.4.2`.

**Fix:**
1. `npm uninstall fhevmjs`
2. `npm install @zama-fhe/relayer-sdk@^0.4.2`
3. Replace every import; the API surface changed.

**Reference:** https://www.npmjs.com/package/fhevmjs (deprecated)

---

### deprecated-fhevm-root

**Trigger:** `Module not found: 'fhevm'` / `Source "fhevm/..." not found`

**Cause:** Root `fhevm` Solidity package deprecated 2025-07-10. Replacement is `@fhevm/solidity@^0.11.1`.

**Fix:**
1. `npm uninstall fhevm && npm install @fhevm/solidity@^0.11.1`
2. Update Solidity imports to `@fhevm/solidity/...`.
3. `npx hardhat compile`.

**Reference:** https://www.npmjs.com/package/fhevm (deprecated)

---

### hcu-exceeded

**Trigger:** `HCU exceeded` / `out of gas` during long FHE op chains

**Cause:** Sepolia enforces ~20M HCU/tx and ~5M depth. Long FHE.add/FHE.select chains, nested FHE.select inside loops, or large encrypted ints exceed the budget.

**Fix:**
1. Run `pnpm gas-report` (or hardhat-gas-reporter) to find the heaviest chain.
2. Split across multiple txs — store intermediate handles in storage.
3. Downcast to a smaller encrypted type (e.g., `euint64` → `euint32`) where the value range allows.

**Reference:** context7 `/zama-ai/fhevm` `topic=hcu`

---

### next-indexeddb-ssr

**Trigger:** `BAILOUT_TO_CLIENT_SIDE_RENDERING` + `ReferenceError: indexedDB is not defined`

**Cause:** wagmi persistent storage and the relayer SDK both require `indexedDB`, which does not exist during Next.js / SSR pre-render.

**Fix:**
1. Add a `mounted` flag flipped by `useEffect` in your providers component.
2. Render `null` until `mounted === true`.
3. Move `createInstance` / `initSDK` calls inside `useEffect` or a client component.

**Reference:** https://wagmi.sh/react/guides/ssr

---

### etherscan-v1-deprecated

**Trigger:** `Etherscan: V1 endpoint deprecated`

**Cause:** `@nomicfoundation/hardhat-verify@^2` migrated to Etherscan v2. The legacy `apiKey: { sepolia: "..." }` object form is rejected.

**Fix:**
1. In `hardhat.config.ts`: `etherscan: { apiKey: process.env.ETHERSCAN_API_KEY }` (string, not object).
2. Set `ETHERSCAN_API_KEY` in `.env` (single multi-chain key works).
3. `npx hardhat verify --network sepolia <addr> [args...]`.

**Reference:** https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-verify

---

### relayer-timeout

**Trigger:** `relayer 502` / `504` / `timeout` / `ETIMEDOUT` / `fetch failed`

**Cause:** Transient unreachability of `https://relayer.testnet.zama.org`. Almost always upstream; sometimes a restrictive client network.

**Fix:**
1. Check Zama status page / Discord `#protocol-status`.
2. `curl -I https://relayer.testnet.zama.org/health`.
3. Retry after 30s; SDK retries internally only once.

**Reference:** https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia

---

### wagmi-undefined-readcontract

**Trigger:** `useReadContract` returns `undefined` / `Function selector ... not found on ABI`

**Cause:** Stale frontend ABI — contract redeployed but ABI not re-synced. wagmi silently returns `undefined` because the function selector mismatches.

**Fix:**
1. `npx tsx scripts/sync-frontend-abi.ts`.
2. Verify the ABI JSON timestamp updated.
3. Restart Vite (`rm -rf node_modules/.vite && npm run dev`).

**Reference:** context7 `/zama-ai/fhevm-hardhat-template` `topic=deploy`

---

### fhe-no-cached-instance

**Trigger:** Runtime error in browser: `[fhe-wagmi] no cached instance — call useFhevmInstance() inside a React component first to initialise.`

**Cause:** `useDecrypted` calls `getFhevmInstance()` (no-args compatibility wrapper) which only returns a cached instance. The fhEVM instance is initialised by the React hook `useFhevmInstance()` reading the wagmi wallet client. If no component fires `useFhevmInstance()` before the user clicks decrypt, the lookup throws.

**Fix:**
1. In the component (or a parent) that renders `useDecrypted`, also call:
   ```ts
   import { useFhevmInstance } from "@zama/lib/fhe";
   useFhevmInstance(); // singleton — fires once, caches the instance
   ```
2. Or hoist `useFhevmInstance()` into your top-level Providers wrapper so every page gets a ready instance automatically.

**Reference:** context7 `/zama-ai/fhevm` `topic=relayer-sdk` + `fhe.ts.tpl` in `/zama-frontend` output

### wagmi-abi-artifact-shape

**Trigger:** Runtime error in production frontend: `r.filter is not a function` (or `abi.filter is not a function`) when clicking a wagmi-wired button.

**Cause:** The ABI passed to `useReadContract` / `useWriteContract` is a Hardhat artifact object (`{contractName, abi: [...]}`) instead of the bare ABI array. wagmi's underlying viem call does `abi.filter(...)` to find the function entry; root objects have no `.filter` method.

**Fix:**
1. In the frontend module that imports the ABI:
   ```ts
   import TokenArtifact from "./abi/Token.json";
   export const TOKEN_ABI = (TokenArtifact as any).abi ?? TokenArtifact;
   ```
2. Or change `sync-frontend-abi.ts` to write only `artifact.abi` (the array) instead of the full artifact JSON.
3. Hard-refresh the frontend after redeploy to bust the stale chunk.

**Reference:** context7 `/zama-ai/fhevm` `topic=frontend` + viem ABI shape docs

### relayer-sdk-eip712-type-mismatch

**Trigger:** `InvalidTypeError UintNumber` / EIP-712 sign failure during `userDecrypt`

**Cause:** `@zama-fhe/relayer-sdk@0.4.x` validates `startTimestamp` and `durationDays` with a zod schema. Different doc snippets show numbers in some examples and strings in others; if the type passed at runtime doesn't match the build's schema, the SDK throws before signing.

**Fix:**
1. Coerce explicitly before `instance.createEIP712()` and `instance.userDecrypt()`. Try numbers first:
   ```ts
   const startTimestamp = Math.floor(Date.now() / 1000);
   const durationDays = 10;
   ```
2. If you still see `InvalidTypeError`, swap to strings:
   ```ts
   const startTimestamp = String(Math.floor(Date.now() / 1000));
   const durationDays = "10";
   ```
3. Always strip `0x` from the signature: `signature.replace(/^0x/, "")`.

**Reference:** https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer/decryption/user-decryption

### kms-public-key-mismatch

**Trigger:** `Invalid public or private key` / `KMS key mismatch` / relayer 403 on decrypt

**Cause:** The relayer / KMS returned a key your client wasn't expecting. Common roots: (a) wallet on a non-Sepolia chain (so the SDK pulled the wrong KMS public key); (b) `useFhevmInstance()` was created against a non-Sepolia network earlier and the cache wasn't invalidated when you switched chains.

**Fix:**
1. Verify chain: `window.ethereum.request({ method: 'eth_chainId' })` should return `'0xaa36a7'` (= 11155111).
2. If you switched chains mid-session, hard-reload (Ctrl+Shift+R), or call `__resetFhevmInstance()` (exported by `fhe-wagmi.ts`).
3. Make sure `createInstance({...SepoliaConfig, network})` runs against a fresh `walletClient` from the active chain.

**Reference:** https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer/initialization

### zama-config-not-found

**Trigger:** Solidity compile: `ZamaEthereumConfig not found` / `ZamaConfig.sol not found`

**Cause:** Import path reorganized in `@fhevm/solidity@0.11.x`. The config now lives at `@fhevm/solidity/config/ZamaConfig.sol`.

**Fix:**
1. `import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";`
2. Pin `@fhevm/solidity@^0.11.1`.
3. `npx hardhat compile`.

**Reference:** context7 `/zama-ai/fhevm` `topic=config`
