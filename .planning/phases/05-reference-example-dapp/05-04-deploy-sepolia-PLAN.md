---
phase: 05-reference-example-dapp
plan: 04
type: execute
wave: 3
depends_on: [01]
files_modified:
  - examples/confidential-token/packages/contracts/scripts/deploy.ts
  - examples/confidential-token/packages/contracts/scripts/register-with-registry.ts
  - examples/confidential-token/packages/contracts/scripts/sync-frontend-abi.ts
  - examples/confidential-token/packages/contracts/hardhat.config.ts
  - examples/confidential-token/packages/contracts/deployments/sepolia/Token.json
  - examples/confidential-token/packages/contracts/.env.example
  - examples/confidential-token/packages/frontend/lib/abi/Token.json
  - examples/confidential-token/packages/frontend/.env.local.example
  - examples/confidential-token/DEPLOYED.md
autonomous: false
requirements: [EXAMPLE-02]
must_haves:
  truths:
    - "Token contract is deployed to Sepolia from wallet 0xFa2961718AE286Fb31A9AeA908F7bDF3bB8237e7"
    - "Etherscan source code is verified for the deployed address"
    - "Token is registered in the Confidential Token Registry on Sepolia"
    - "deploy script is one command: `pnpm hardhat deploy --network sepolia` runs deploy + verify + register sequentially and is idempotent"
    - "Deployed address is captured in deployments/sepolia/Token.json AND DEPLOYED.md AND frontend .env.local.example"
    - "Sepolia infrastructure addresses (ACL, KMS, Coprocessor, Registry) are fetched at runtime from docs.zama.org — never pinned in source per CLAUDE.md"
    - "Private key is loaded from .env.deploy.local (gitignored) — never committed"
  artifacts:
    - path: "examples/confidential-token/packages/contracts/scripts/deploy.ts"
      provides: "Single-entry deploy + verify + register script"
      contains: "registerConfidentialToken"
    - path: "examples/confidential-token/packages/contracts/deployments/sepolia/Token.json"
      provides: "Canonical deployment record (address, abi, txHash, blockNumber)"
      contains: "address"
    - path: "examples/confidential-token/DEPLOYED.md"
      provides: "Human-readable deploy summary with Etherscan + Registry links"
      contains: "sepolia.etherscan.io"
  key_links:
    - from: "scripts/deploy.ts"
      to: ".env.deploy.local PRIVATE_KEY"
      via: "process.env loaded by hardhat.config.ts"
      pattern: "PRIVATE_KEY"
    - from: "scripts/deploy.ts"
      to: "Confidential Token Registry on Sepolia"
      via: "registry.registerToken(address, name, symbol, decimals)"
      pattern: "registerToken"
    - from: "scripts/sync-frontend-abi.ts"
      to: "packages/frontend/lib/abi/Token.json"
      via: "post-deploy copy of artifact ABI"
      pattern: "Token.json"
---

<objective>
Wire `hardhat-deploy` to deploy the Token contract to Sepolia, run `hardhat verify` against Etherscan, register the token in the Confidential Token Registry, and propagate the deployed address + ABI back into the frontend env example. Deploy with the funded wallet `0xFa29…37e7` whose key lives in `.env.deploy.local`.

Purpose: Without a verified, registered, deployed address, EXAMPLE-02 is not met and the frontend cannot demonstrate end-to-end UX.
Output: A live Sepolia contract address + verified source + registry entry, plus a one-command idempotent deploy script.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-reference-example-dapp/05-CONTEXT.md
@CLAUDE.md
@plugins/zama-skills/skills/deploy/SKILL.md
@plugins/zama-skills/shared/pinned-versions.json
@.planning/phases/05-reference-example-dapp/05-01-scaffold-from-skills-PLAN.md

<interfaces>
Deploy wallet: `0xFa2961718AE286Fb31A9AeA908F7bDF3bB8237e7` — funded with 0.3 Sepolia ETH. Key in `examples/confidential-token/.env.deploy.local`:
```
PRIVATE_KEY=0x...                     # the deploy wallet's key (gitignored)
ETHERSCAN_API_KEY=...                 # for hardhat verify
SEPOLIA_RPC_URL=https://...           # Alchemy / Infura
```
`.env.example` (committed, no secrets) documents these names.

Confidential Token Registry on Sepolia: address fetched at runtime from `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` (per CLAUDE.md — "never pin"). Cache the JSON response in-memory in `scripts/lib/zama-addresses.ts`. Registry ABI fragment we need:
```
function registerToken(address token, string name, string symbol, uint8 decimals) external
```
(Confirm exact signature via context7 `mcp__context7__get-library-docs` with topic="registry" before deploy.)

Deploy script outline (`scripts/deploy.ts` invoked by `hardhat-deploy`):
1. Resolve Sepolia infra addresses (ACL/KMS/Coprocessor/Registry) via `getZamaAddresses('sepolia')`.
2. Deploy `Token` with constructor `(name="Confidential Demo Token", symbol="cDEMO", decimals=6)`.
3. Wait 5 confirmations (Etherscan indexing).
4. Run `hardhat verify --network sepolia <address> "Confidential Demo Token" cDEMO 6` (programmatic via `hre.run('verify:verify', ...)`).
5. Call `registry.registerToken(tokenAddress, name, symbol, decimals)` — skip if already registered (catch revert "AlreadyRegistered").
6. Write `deployments/sepolia/Token.json` (hardhat-deploy does this automatically + a thin custom field `registry: { txHash, address }`).
7. Run `scripts/sync-frontend-abi.ts` to copy ABI into frontend.
8. Append/refresh `DEPLOYED.md` with Etherscan + Registry tx links.

Idempotency: re-running `pnpm hardhat deploy --network sepolia` does NOT redeploy if `deployments/sepolia/Token.json` exists (hardhat-deploy default). Pass `--reset` to force.

CHECKPOINT: User verifies the Etherscan link is green (verified) and the Registry link shows the token entry, before Plan 05 runs.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author deploy.ts + register + sync-abi scripts + hardhat.config wiring</name>
  <files>examples/confidential-token/packages/contracts/scripts/{deploy.ts,register-with-registry.ts,sync-frontend-abi.ts,lib/zama-addresses.ts}, examples/confidential-token/packages/contracts/hardhat.config.ts, examples/confidential-token/packages/contracts/.env.example</files>
  <action>
1. `scripts/lib/zama-addresses.ts`: small fetcher that hits `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` (per CLAUDE.md "fetch live"), parses the addresses table, and returns `{ acl, kms, coprocessor, registry, relayer }`. Cache result on disk in `cache/zama-addresses.sepolia.json` (24h TTL) so re-runs don't hammer docs.zama.org. If fetch fails, fall back to cache; if no cache, abort with explicit error.
2. `scripts/deploy.ts` (hardhat-deploy module export): implement steps 1–8 from `<interfaces>`. Use `ethers v6` (matches CLAUDE.md pin). Each step prints a banner with timing.
3. `scripts/register-with-registry.ts`: standalone runner so user can re-register without redeploying. Reuses logic from `deploy.ts` step 5.
4. `scripts/sync-frontend-abi.ts`: `cp packages/contracts/artifacts/contracts/Token.sol/Token.json` → extract `.abi` → write `packages/frontend/lib/abi/Token.json`. Idempotent.
5. Update `hardhat.config.ts` (already produced by /zama-init) to:
   - Load `dotenv` from `.env.deploy.local` (ahead of `.env`) so the deploy key takes precedence.
   - Configure `networks.sepolia` with `url: process.env.SEPOLIA_RPC_URL`, `accounts: [process.env.PRIVATE_KEY!]`.
   - Configure `etherscan.apiKey.sepolia: process.env.ETHERSCAN_API_KEY`.
   - Configure `namedAccounts: { deployer: { default: 0 } }`.
6. Author `.env.example` documenting the three required env vars (NO secrets).
7. Update root `examples/confidential-token/.gitignore` to include `cache/zama-addresses.*.json` if you want fresh fetches, or commit cache for reproducibility — pick: commit cache (better for CI smoke-diff stability), document choice.
8. Commit: `feat(05): deploy + verify + register scripts for sepolia`.
  </action>
  <verify>
    <automated>cd examples/confidential-token/packages/contracts && pnpm hardhat compile && node -e "const fs=require('fs'); for (const f of ['scripts/deploy.ts','scripts/register-with-registry.ts','scripts/sync-frontend-abi.ts','scripts/lib/zama-addresses.ts','.env.example']) if (!fs.existsSync(f)) { console.error('missing',f); process.exit(1); }" && grep -q "PRIVATE_KEY" hardhat.config.ts && grep -q "etherscan" hardhat.config.ts</automated>
  </verify>
  <done>All four scripts present; hardhat.config wired to .env.deploy.local + Etherscan; compile still green.</done>
</task>

<task type="auto">
  <name>Task 2: Run deploy + verify + register on Sepolia, capture artifacts</name>
  <files>examples/confidential-token/packages/contracts/deployments/sepolia/Token.json, examples/confidential-token/packages/frontend/lib/abi/Token.json, examples/confidential-token/packages/frontend/.env.local.example, examples/confidential-token/DEPLOYED.md</files>
  <action>
1. Confirm `examples/confidential-token/.env.deploy.local` exists with the funded wallet's PRIVATE_KEY (file MUST be gitignored — verify `git check-ignore .env.deploy.local` returns the path).
2. From `examples/confidential-token/packages/contracts/`:
   ```
   pnpm hardhat deploy --network sepolia
   ```
   This runs deploy → wait 5 confs → verify → register → write artifacts → sync ABI.
3. Capture stdout into `DEPLOYED.md` at the example root with sections:
   - Deployed address + Etherscan link (`https://sepolia.etherscan.io/address/<addr>#code`)
   - Verification status (Etherscan API response)
   - Registry tx hash + Registry Etherscan link
   - Block number + timestamp + deploy wallet
   - One-line "How to redeploy: …" instructions
4. Update `packages/frontend/.env.local.example` to set `NEXT_PUBLIC_CONTRACT_ADDRESS=<deployed-address>` as the default value (or as a clear `# DEPLOYED: 0x…` comment so users see what to copy into Vercel).
5. Verify `lib/abi/Token.json` matches the on-chain bytecode (the sync script wrote it; sanity-check the ABI count matches the contract surface — at minimum `balanceOf, mint, transfer, decimals, name, symbol`).
6. Commit: `chore(05): deploy Token to Sepolia 0x…  + verify + register`.
  </action>
  <verify>
    <automated>cd examples/confidential-token && test -f packages/contracts/deployments/sepolia/Token.json && node -e "const j=require('./packages/contracts/deployments/sepolia/Token.json'); if(!j.address || !/^0x[0-9a-fA-F]{40}$/.test(j.address)) process.exit(1); console.log('deployed at',j.address)" && grep -q "sepolia.etherscan.io" DEPLOYED.md && grep -q "$(node -p "require('./packages/contracts/deployments/sepolia/Token.json').address")" packages/frontend/.env.local.example</automated>
  </verify>
  <done>Sepolia deployment landed; Etherscan shows verified source; Registry tx confirmed; DEPLOYED.md committed; frontend env example points to live address.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human confirms Etherscan verified + Registry entry visible</name>
  <what-built>Token deployed to Sepolia, source verified on Etherscan, registered in Confidential Token Registry. Address + links written to DEPLOYED.md.</what-built>
  <how-to-verify>
1. Open the Etherscan link in `examples/confidential-token/DEPLOYED.md`. The "Contract" tab MUST show a green "Verified" check and source code with the OZ ERC7984 import resolved.
2. Open the Registry link in DEPLOYED.md. The token (cDEMO) MUST appear in the registry's tokens list with the correct address, name, symbol, decimals.
3. From `examples/confidential-token/packages/frontend/`, set `NEXT_PUBLIC_CONTRACT_ADDRESS` in `.env.local` to the deployed address, run `pnpm dev`, connect MetaMask on Sepolia, click Mint — confirm a tx is submitted and that BalanceCard transitions through the 4 states.
  </how-to-verify>
  <resume-signal>Type "verified" once Etherscan green-check + Registry entry are visible AND mint+balance round-trip works locally. If broken: describe the failure and Plan 04 runs again.</resume-signal>
</task>

</tasks>

<verification>
1. `deployments/sepolia/Token.json` has a valid 0x address and a `transactionHash`.
2. `DEPLOYED.md` links resolve to Etherscan verified source AND Registry entry.
3. `lib/abi/Token.json` is in sync with the deployed artifact.
4. `.env.deploy.local` is gitignored (run `git check-ignore`).
5. Local frontend dev with the deployed address performs a mint successfully.
</verification>

<success_criteria>
- EXAMPLE-02 met: deployed + verified + registered
- One-command deploy is idempotent and re-runnable
- Private key never leaves `.env.deploy.local`
- Sepolia infra addresses fetched live (no pinning)
- Frontend env example carries the live address into Plan 05
</success_criteria>

<output>
Create `.planning/phases/05-reference-example-dapp/05-04-SUMMARY.md` with: deployed address, Etherscan + Registry tx hashes, gas spent, any deploy retries needed, registry signature confirmation source.
</output>
