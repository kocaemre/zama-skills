# /zama-debug — Pattern Catalog

Patterns registered: **12**

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

### relayer-sdk-bundle-import

**Trigger:** `TypeError: Cannot read properties of undefined (reading 'initSDK')`

**Cause:** Imported `@zama-fhe/relayer-sdk/bundle` (Node-only) inside a browser/Vite build. Browsers must use `@zama-fhe/relayer-sdk/web`.

**Fix:**
1. Change `from "@zama-fhe/relayer-sdk/bundle"` → `from "@zama-fhe/relayer-sdk/web"`.
2. `rm -rf node_modules/.vite && npm run dev`.

**Reference:** https://docs.zama.ai/protocol/relayer-sdk/web-vs-bundle

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

**Cause:** Transient unreachability of `https://relayer.testnet.zama.cloud`. Almost always upstream; sometimes a restrictive client network.

**Fix:**
1. Check Zama status page / Discord `#protocol-status`.
2. `curl -I https://relayer.testnet.zama.cloud/health`.
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

### zama-config-not-found

**Trigger:** Solidity compile: `ZamaEthereumConfig not found` / `ZamaConfig.sol not found`

**Cause:** Import path reorganized in `@fhevm/solidity@0.11.x`. The config now lives at `@fhevm/solidity/config/ZamaConfig.sol`.

**Fix:**
1. `import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";`
2. Pin `@fhevm/solidity@^0.11.1`.
3. `npx hardhat compile`.

**Reference:** context7 `/zama-ai/fhevm` `topic=config`
