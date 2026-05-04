/**
 * patterns.ts — known fhEVM error patterns matched by /zama-debug.
 *
 * Each entry maps a regex (matched against pasted error text) to a
 * structured diagnosis: likely cause, concrete fix command(s), reference
 * link. Keep this list in sync with `assets/PATTERNS.md` (CI cross-check).
 *
 * Add new patterns by appending to PATTERNS — order matters only for
 * tie-breaking (first match wins; place more specific patterns first).
 */

export interface DebugPattern {
  /** Stable kebab-case identifier; mirrored as the heading in PATTERNS.md. */
  name: string;
  /** Short human-readable label (one line, ≤80 chars). */
  label: string;
  /** Regex matched against the full pasted error text (case-insensitive). */
  pattern: RegExp;
  /** One-paragraph explanation of the likely root cause. */
  cause: string;
  /**
   * Ordered fix steps. Each entry is either a shell command (prefixed with
   * `$ `) or a free-text instruction. Caller renders verbatim.
   */
  fix: string[];
  /** Single canonical reference URL or context7 query string. */
  reference: string;
}

export const PATTERNS: DebugPattern[] = [
  {
    name: "acl-not-allowed",
    label: "Revert: ACL: not allowed (missing FHE.allow / FHE.allowThis)",
    pattern: /(ACL[:\s]*not allowed|ACLNotAllowed|allowed\(\) returned false)/i,
    cause:
      "The Zama Protocol ACL rejected a read of an encrypted handle because no grant was attached to the calling address (or the contract itself). Every state-write of an encrypted value must be paired with FHE.allowThis(handle); every handle returned to a user must also receive FHE.allow(handle, msg.sender) before being read off-chain.",
    fix: [
      "Locate the function that produces or stores the encrypted handle.",
      "Immediately after the assignment, add: FHE.allowThis(handle);",
      "If the handle is meant for off-chain user-decrypt, also add: FHE.allow(handle, msg.sender);",
      "Recompile and re-run the failing call.",
      "$ npx hardhat compile",
    ],
    reference: "context7 /zama-ai/fhevm topic=acl",
  },
  {
    name: "relayer-sdk-init-undefined",
    label: "TypeError: Cannot read properties of undefined (reading 'initSDK')",
    pattern: /Cannot read propert(y|ies) of undefined \(reading ['\"]initSDK['\"]\)/i,
    cause:
      "`initSDK` is undefined at call time. Two common causes: (a) the SDK is loaded as a UMD `<script>` tag and the page references `window.fhevm.initSDK` before the script finishes evaluating; (b) Server-Side Rendering (Next.js / Remix) evaluates a module that imports the SDK at top level — the WASM loader runs in the Node phase and is undefined when the client bundle re-imports.",
    fix: [
      "Use the canonical browser ESM entry: `import { initSDK, createInstance, SepoliaConfig } from \"@zama-fhe/relayer-sdk/bundle\"` (or bare `@zama-fhe/relayer-sdk` if your bundler prefers ESM).",
      "Wrap initialization in `useEffect(() => { void initSDK(); }, [])` for React, or guard with `typeof window !== \"undefined\"` for SSR frameworks.",
      "If using Next.js: mark the file `\"use client\"` and create the SDK instance inside a Client Component.",
      "Restart the dev server so Vite/Webpack re-resolves the entry.",
      "$ rm -rf node_modules/.vite && npm run dev",
    ],
    reference:
      "https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer/initialization",
  },
  {
    name: "deprecated-fhevmjs",
    label: "Module not found: 'fhevmjs' (deprecated 2025-07-10)",
    pattern: /(Module not found|Cannot find module)[^\n]*['\"]fhevmjs['\"]/i,
    cause:
      "`fhevmjs` was officially deprecated 2025-07-10. The replacement is `@zama-fhe/relayer-sdk@^0.4.2`. Skills MUST refuse to install or import the deprecated package — it has no upstream support and will fail against the current Sepolia KMS/relayer contracts.",
    fix: [
      "$ npm uninstall fhevmjs",
      "$ npm install @zama-fhe/relayer-sdk@^0.4.2",
      "Replace every `import ... from \"fhevmjs\"` with `import ... from \"@zama-fhe/relayer-sdk/bundle\"` (browser) or `/node` (Node).",
      "Re-check call sites — the API surface changed (e.g., `createInstance` signature).",
    ],
    reference: "https://www.npmjs.com/package/fhevmjs (deprecated)",
  },
  {
    name: "deprecated-fhevm-root",
    label: "Module not found: 'fhevm' (deprecated 2025-07-10)",
    pattern: /(Module not found|Cannot find module|File import callback not supported)[^\n]*['\"]fhevm['\"](?!\/)/i,
    cause:
      "The root `fhevm` Solidity package was deprecated 2025-07-10. The replacement is `@fhevm/solidity@^0.11.1`, which is what `@openzeppelin/confidential-contracts` and `@fhevm/hardhat-plugin` peer-depend on.",
    fix: [
      "$ npm uninstall fhevm",
      "$ npm install @fhevm/solidity@^0.11.1",
      "Replace every Solidity `import \"fhevm/...\"` with `import \"@fhevm/solidity/...\"`.",
      "$ npx hardhat compile",
    ],
    reference: "https://www.npmjs.com/package/fhevm (deprecated)",
  },
  {
    name: "hcu-exceeded",
    label: "HCU exceeded / out of gas during FHE op chain",
    pattern: /(HCU exceeded|HCU budget|homomorphic compute units|out of gas)/i,
    cause:
      "Sepolia enforces an HCU (homomorphic compute units) budget of ~20M per tx and ~5M depth. Long FHE.add/FHE.select chains, nested FHE.select inside loops, or large encrypted-int operations exceed the budget and revert. The fix is structural: split the chain across multiple transactions, hoist invariant work, or use a smaller encrypted type (euint32 instead of euint64 where range allows).",
    fix: [
      "Profile the failing tx: `pnpm gas-report` or hardhat-gas-reporter output.",
      "Identify the longest FHE op chain (typically nested FHE.select or for-loops).",
      "Split into multiple txs: store intermediate handles in storage, finalize in a follow-up call.",
      "If feasible, downcast (e.g., euint64 → euint32) — smaller types use fewer HCUs per op.",
      "Re-run the failing test with the split flow.",
    ],
    reference: "context7 /zama-ai/fhevm topic=hcu",
  },
  {
    name: "next-indexeddb-ssr",
    label: "BAILOUT_TO_CLIENT_SIDE_RENDERING + indexedDB undefined",
    pattern: /(BAILOUT_TO_CLIENT_SIDE_RENDERING|indexedDB is not defined|ReferenceError: indexedDB)/i,
    cause:
      "The relayer SDK and wagmi's persistent storage rely on `indexedDB`, which does not exist during Next.js / SSR pre-rendering. Mounting WagmiProvider at module top level evaluates the storage factory on the server and crashes. The Phase 5 fix is to gate the provider tree behind a `mounted` boolean that flips after `useEffect` runs (client-only).",
    fix: [
      "In your top-level providers component, add: `const [mounted, setMounted] = useState(false);`",
      "Add: `useEffect(() => setMounted(true), []);`",
      "Render `if (!mounted) return null;` before the WagmiProvider tree.",
      "Move every relayer-sdk `createInstance` / `initSDK` call inside `useEffect` or a client component.",
      "$ npm run dev (verify no SSR error)",
    ],
    reference:
      "https://wagmi.sh/react/guides/ssr",
  },
  {
    name: "etherscan-v1-deprecated",
    label: "Etherscan: V1 endpoint deprecated",
    pattern: /(Etherscan[^\n]*V1[^\n]*deprecat|api\.etherscan\.io\/v1)/i,
    cause:
      "`@nomicfoundation/hardhat-verify@^2` migrated to Etherscan v2 and rejects the legacy `etherscan: { apiKey: { sepolia: \"...\" } }` object form. The current shape is a top-level string: `etherscan: { apiKey: process.env.ETHERSCAN_API_KEY }`.",
    fix: [
      "Open `hardhat.config.ts`.",
      "Replace `etherscan: { apiKey: { sepolia: \"...\" } }` with `etherscan: { apiKey: process.env.ETHERSCAN_API_KEY }`.",
      "Ensure `ETHERSCAN_API_KEY` is set in `.env` (a single multi-chain key now works for Sepolia/Mainnet).",
      "$ npx hardhat verify --network sepolia <addr> [args...]",
    ],
    reference:
      "https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-verify",
  },
  {
    name: "relayer-timeout",
    label: "Relayer 502 / timeout / network error",
    pattern: /(relayer[^\n]*(502|504|timeout|ETIMEDOUT|ECONNRESET|fetch failed))/i,
    cause:
      "The Zama relayer at `https://relayer.testnet.zama.org` is transiently unreachable. This is almost always upstream — verify status, then retry with exponential backoff. If persistent, your network may be blocking the relayer host.",
    fix: [
      "Check the Zama status page or the #protocol-status channel in Zama's Discord.",
      "$ curl -I https://relayer.testnet.zama.org/health",
      "Retry the failing call after 30s; the SDK retries internally only once.",
      "If the user is on a corporate / restrictive network, suggest a different network or VPN.",
    ],
    reference:
      "https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia",
  },
  {
    name: "wagmi-undefined-readcontract",
    label: "wagmi useReadContract returns undefined (ABI mismatch)",
    pattern: /(useReadContract[^\n]*undefined|ContractFunctionExecutionError|Function .* not found on ABI|Function selector)/i,
    cause:
      "The frontend ABI is stale: the contract was redeployed (or function signature changed) but the ABI bundled into the React app still reflects the old shape. wagmi silently returns `undefined` because the function selector does not match. The fix is to re-sync ABIs from the deployments artifact into the frontend.",
    fix: [
      "$ npx tsx scripts/sync-frontend-abi.ts",
      "Verify the ABI file (`packages/frontend/src/abi/<Contract>.json`) timestamp updated.",
      "Restart the dev server so Vite re-imports the ABI.",
      "$ rm -rf node_modules/.vite && npm run dev",
    ],
    reference: "context7 /zama-ai/fhevm-hardhat-template topic=deploy",
  },
  {
    name: "fhe-no-cached-instance",
    label: "useDecrypted error: no cached instance",
    pattern: /(\[fhe-?wagmi\]|fhe).*no cached instance|getFhevmInstance.*no cached instance|call useFhevmInstance/i,
    cause:
      "`useDecrypted` calls `getFhevmInstance()` (the no-args compatibility wrapper) which only returns a cached instance — it does NOT initialise one. The fhEVM instance is initialised by the React hook `useFhevmInstance()` (which reads the wagmi wallet client). If no component in the tree calls `useFhevmInstance()` before the user clicks decrypt, the lookup throws this error.",
    fix: [
      "In the component (or a parent) that renders `useDecrypted`, also call `useFhevmInstance()` once at the top:",
      'import { useFhevmInstance } from "@zama/lib/fhe";',
      "useFhevmInstance(); // singleton — fires once, caches the instance",
      "Alternative: hoist `useFhevmInstance()` into your top-level Providers wrapper so every page gets a ready instance automatically.",
    ],
    reference: "context7 /zama-ai/fhevm topic=relayer-sdk + fhe.ts.tpl in /zama-frontend output",
  },
  {
    name: "wagmi-abi-artifact-shape",
    label: "wagmi runtime: r.filter is not a function (ABI artifact shape)",
    pattern: /(r\.filter is not a function|abi\.filter is not a function|filter is not a function)/i,
    cause:
      "The ABI passed to `useReadContract` / `useWriteContract` is a Hardhat artifact object (`{contractName, abi: [...]}`) instead of the bare ABI array. wagmi's underlying viem call does `abi.filter(...)` to find the function entry — root objects have no `.filter` method, so it throws this exact message in production builds.",
    fix: [
      "In the frontend module that imports the ABI, unwrap before exporting:",
      'import TokenArtifact from "./abi/Token.json";',
      "export const TOKEN_ABI = (TokenArtifact as any).abi ?? TokenArtifact;",
      "Or: change `sync-frontend-abi.ts` to write only `artifact.abi` (the array) instead of the full hardhat artifact JSON.",
      "Hard-refresh the frontend after redeploy to bust the stale chunk.",
    ],
    reference: "context7 /zama-ai/fhevm topic=frontend + viem ABI shape docs",
  },
  {
    name: "relayer-sdk-eip712-type-mismatch",
    label: "InvalidTypeError UintNumber / EIP-712 sign during userDecrypt",
    pattern: /(InvalidTypeError[^\n]*UintNumber|EIP[- ]712[^\n]*Invalid signature|userDecrypt[^\n]*Invalid (signature|type))/i,
    cause:
      "`@zama-fhe/relayer-sdk@0.4.x` validates `startTimestamp` and `durationDays` with a zod schema. Different doc snippets show numbers in some examples and strings in others; if the type passed at runtime doesn't match the build's schema, the SDK throws before signing. Common causes: (a) a JSON.parse round-trip that converts numbers to strings, (b) copying `Math.floor(Date.now()/1000).toString()` into a build that expects numbers, or (c) the inverse.",
    fix: [
      "Coerce both fields explicitly before calling `instance.createEIP712()` and `instance.userDecrypt()`. The defensive shape that works against both behaviours:",
      "  const startTimestamp = Math.floor(Date.now() / 1000); // number",
      "  const durationDays = 10;                              // number",
      "If you still see InvalidTypeError, swap to strings:",
      "  const startTimestamp = String(Math.floor(Date.now() / 1000));",
      "  const durationDays = '10';",
      "Always strip the `0x` prefix from the EIP-712 signature before passing to `userDecrypt`: `signature.replace(/^0x/, '')`.",
      "Reference: https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer/decryption/user-decryption",
    ],
    reference: "https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer/decryption/user-decryption",
  },
  {
    name: "kms-public-key-mismatch",
    label: "createInstance / userDecrypt: 'Invalid public or private key'",
    pattern: /(Invalid (public|private) key|KMS[^\n]*key (mismatch|not found)|relayer.*decrypt.*403)/i,
    cause:
      "The relayer / KMS returned a key your client wasn't expecting. Two common roots: (a) the wallet is on a chain that isn't Sepolia (chainId 11155111) — the SDK pulled the wrong KMS public key; (b) `useFhevmInstance()` was created against a non-Sepolia network earlier in the session and the cache wasn't invalidated when you switched chains.",
    fix: [
      "Verify chain in DevTools console: `window.ethereum.request({ method: 'eth_chainId' })` — expect `'0xaa36a7'` (= 11155111).",
      "If you switched chains mid-session, hard-reload (Ctrl+Shift+R) so the singleton resets, or call `__resetFhevmInstance()` (exported by `fhe-wagmi.ts`).",
      "If the chain is correct, ensure your `createInstance({...SepoliaConfig, network})` is on a fresh `walletClient` from the active chain (wagmi `useWalletClient()` switches when chain changes).",
    ],
    reference: "https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer/initialization",
  },
  {
    name: "zama-config-not-found",
    label: "Solidity compile: ZamaEthereumConfig not found",
    pattern: /(ZamaEthereumConfig|ZamaConfig\.sol)[^\n]*(not found|undeclared|cannot find)/i,
    cause:
      "`ZamaEthereumConfig` (and the `SepoliaConfig` companion contract) live under `@fhevm/solidity/config/ZamaConfig.sol`. The import path was reorganized in `@fhevm/solidity@0.11.x` — older snippets that import directly from `@fhevm/solidity/ZamaConfig.sol` will fail.",
    fix: [
      "In your contract, change the import to: `import { SepoliaConfig } from \"@fhevm/solidity/config/ZamaConfig.sol\";`",
      "Make sure `@fhevm/solidity` is `^0.11.1` in package.json.",
      "$ npm install @fhevm/solidity@^0.11.1",
      "$ npx hardhat compile",
    ],
    reference: "context7 /zama-ai/fhevm topic=config",
  },
];

/** Number of patterns currently registered. Used by tests + PATTERNS.md sync. */
export const PATTERN_COUNT: number = PATTERNS.length;
