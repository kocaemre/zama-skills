---
phase: 03-zama-init-end-to-end
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - plugins/zama-skills/skills/init/assets/templates/pnpm-workspace.yaml.tpl
  - plugins/zama-skills/skills/init/assets/templates/root-package.json.tpl
  - plugins/zama-skills/skills/init/assets/templates/root-readme.md.tpl
  - plugins/zama-skills/skills/init/assets/templates/.env.example.tpl
  - plugins/zama-skills/skills/init/assets/templates/.gitignore.tpl
  - plugins/zama-skills/skills/init/assets/templates/packages/contracts/package.json.tpl
  - plugins/zama-skills/skills/init/assets/templates/packages/contracts/hardhat.config.ts.tpl
  - plugins/zama-skills/skills/init/assets/templates/packages/contracts/tsconfig.json.tpl
  - plugins/zama-skills/skills/init/assets/templates/packages/frontend/package.json.tpl
  - plugins/zama-skills/skills/init/assets/templates/packages/frontend/vite.config.ts.tpl
  - plugins/zama-skills/skills/init/assets/templates/packages/frontend/index.html.tpl
  - plugins/zama-skills/skills/init/assets/templates/packages/frontend/src/main.tsx.tpl
  - plugins/zama-skills/skills/init/assets/templates/packages/frontend/src/App.tsx.tpl
autonomous: true
requirements: [INIT-02, INIT-03, INIT-04]
must_haves:
  truths:
    - "All 13 template files exist under plugins/zama-skills/skills/init/assets/templates/"
    - "Every package version reference uses <!-- @pin:<pkg> --> placeholder (no concrete versions inline)"
    - ".env.example.tpl contains INFURA_API_KEY, MNEMONIC, ETHERSCAN_API_KEY, RELAYER_URL, SEPOLIA_RPC_URL with explanatory comments"
    - "root-readme.md.tpl contains 30-second value prop, MetaMask Sepolia deep-link, 3 faucet URLs"
    - "hardhat.config.ts.tpl imports @fhevm/hardhat-plugin and pins solc 0.8.27 via @pin:solc"
    - "Zero deprecated package names appear in any template (no fhevmjs, no root fhevm)"
  artifacts:
    - path: "plugins/zama-skills/skills/init/assets/templates/root-package.json.tpl"
      provides: "Root workspace package.json with workspace scripts"
      contains: "@pin:"
    - path: "plugins/zama-skills/skills/init/assets/templates/packages/contracts/hardhat.config.ts.tpl"
      provides: "Hardhat config with @fhevm/hardhat-plugin import"
      contains: "@fhevm/hardhat-plugin"
    - path: "plugins/zama-skills/skills/init/assets/templates/.env.example.tpl"
      provides: "Sepolia env scaffold"
      contains: "RELAYER_URL"
  key_links:
    - from: "templates/**/*.tpl"
      to: "shared/pinned-versions.json"
      via: "@pin:<pkg> placeholders resolved at scaffold runtime"
      pattern: "@pin:[a-zA-Z0-9@/_.-]+"
---

<objective>
Author the 13 template files that drive the scaffolded confidential-dApp monorepo. Templates use the `<!-- @pin:<pkg> -->` placeholder syntax (same as `scripts/build.ts` examples handler — see ORCHESTRATION.md) so concrete versions live only in `shared/pinned-versions.json`.

Purpose: Versions stay DRY. Bumping `@fhevm/solidity` in pinned-versions.json is the only edit needed.
Output: 13 .tpl files, all deprecation-free, all version-placeholders resolved at scaffold time by 03-04.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-zama-init-end-to-end/03-CONTEXT.md
@.planning/phases/03-zama-init-end-to-end/ORCHESTRATION.md
@plugins/zama-skills/shared/pinned-versions.json
@plugins/zama-skills/shared/snippets/sepolia-faucet.md
@scripts/build.ts

<interfaces>
- Pin placeholder regex (already used by build.ts): `/<!--\s*@pin:([^\s>]+)\s*-->/g`
- Resolved at scaffold runtime by `getVersion(pkg)` from `scripts/lib/versions.ts`.
- Template file extension: `.tpl` (so they aren't accidentally executed/imported in the plugin repo itself).
- Frontend stack pinned: Vite + React 18 + ethers v6 + `@zama-fhe/relayer-sdk@^0.4.2` (CONTEXT decision).
- Workspace tool: pnpm (CONTEXT decision).
- Solidity compiler: 0.8.27 (CLAUDE.md / pinned-versions).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Root + workspace + env templates</name>
  <files>
    plugins/zama-skills/skills/init/assets/templates/pnpm-workspace.yaml.tpl,
    plugins/zama-skills/skills/init/assets/templates/root-package.json.tpl,
    plugins/zama-skills/skills/init/assets/templates/root-readme.md.tpl,
    plugins/zama-skills/skills/init/assets/templates/.env.example.tpl,
    plugins/zama-skills/skills/init/assets/templates/.gitignore.tpl
  </files>
  <action>
Create 5 root-level templates.

**`pnpm-workspace.yaml.tpl`**:
```yaml
packages:
  - "packages/*"
```

**`root-package.json.tpl`**:
```jsonc
{
  "name": "{{USE_CASE}}-dapp",
  "private": true,
  "version": "0.1.0",
  "engines": { "node": ">=20" },
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "compile": "pnpm --filter contracts hardhat compile",
    "test": "pnpm --filter contracts hardhat test",
    "dev:frontend": "pnpm --filter frontend dev"
  },
  "devDependencies": {
    "typescript": "<!-- @pin:typescript -->"
  }
}
```
NB: `{{USE_CASE}}` is a runtime substitution handled by 03-04's scaffold.ts (not a `@pin:`).
NB: The `typescript` key in pinned-versions.json is at top-level not under `packages` — 03-04 must handle this. To avoid that complexity, hardcode `^5.9.3` here ONLY for typescript (matches CLAUDE.md). Document in template comment: `// typescript pinned to 5.9.3 — bump in template if pinned-versions.json changes`.

**`root-readme.md.tpl`** (target ~80 lines):
- H1: `# {{USE_CASE_TITLE}} — Confidential dApp`
- 30-second value prop block (3-5 sentences): "This project was scaffolded by `/zama-init` from zama-skills. It runs on Sepolia testnet using Zama Protocol's fhEVM... pinned versions verified live via context7..."
- "Quick start" section: `pnpm install` → fill `.env` → `pnpm compile` → next steps
- "Configure Sepolia in MetaMask": link to `https://chainid.network/?search=sepolia` (clickable)
- "Get testnet ETH": 3 faucet URLs verbatim from `shared/snippets/sepolia-faucet.md`
- "Pinned versions": short paragraph + link to `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia` for live address registry
- "Next steps in Claude Code": list `/zama-contract`, `/zama-test`, `/zama-deploy --sepolia`, `/zama-frontend`
- Footer: "Generated by zama-skills. Do not commit `.env`."

**`.env.example.tpl`** (every line gets a `# why` comment):
```
# Sepolia RPC endpoint — get an Infura key at https://www.infura.io/
INFURA_API_KEY=
# Optional alternative — Alchemy Sepolia RPC: https://www.alchemy.com/
ALCHEMY_API_KEY=
# 12-word BIP-39 phrase for deployer wallet. TEST MNEMONIC ONLY — never use mainnet keys.
MNEMONIC=
# Etherscan API key for contract verification: https://etherscan.io/myapikey
ETHERSCAN_API_KEY=
# Zama relayer (verify current URL via context7 /zama-ai/fhevm topic:"relayer" before changing)
RELAYER_URL=https://relayer.testnet.zama.cloud
# Sepolia RPC URL — derived from INFURA_API_KEY at runtime by hardhat.config.ts; override only if using a custom provider.
SEPOLIA_RPC_URL=
```

**`.gitignore.tpl`**:
```
node_modules/
.env
.env.local
artifacts/
cache/
typechain-types/
coverage/
.DS_Store
dist/
.vite/
```
  </action>
  <verify>
    <automated>
      test -f plugins/zama-skills/skills/init/assets/templates/pnpm-workspace.yaml.tpl && \
      test -f plugins/zama-skills/skills/init/assets/templates/root-package.json.tpl && \
      test -f plugins/zama-skills/skills/init/assets/templates/root-readme.md.tpl && \
      test -f plugins/zama-skills/skills/init/assets/templates/.env.example.tpl && \
      test -f plugins/zama-skills/skills/init/assets/templates/.gitignore.tpl && \
      grep -q "INFURA_API_KEY" plugins/zama-skills/skills/init/assets/templates/.env.example.tpl && \
      grep -q "MNEMONIC" plugins/zama-skills/skills/init/assets/templates/.env.example.tpl && \
      grep -q "ETHERSCAN_API_KEY" plugins/zama-skills/skills/init/assets/templates/.env.example.tpl && \
      grep -q "RELAYER_URL" plugins/zama-skills/skills/init/assets/templates/.env.example.tpl && \
      grep -q "SEPOLIA_RPC_URL" plugins/zama-skills/skills/init/assets/templates/.env.example.tpl && \
      grep -q "chainid.network" plugins/zama-skills/skills/init/assets/templates/root-readme.md.tpl && \
      grep -c "faucet" plugins/zama-skills/skills/init/assets/templates/root-readme.md.tpl | { read n; [ "$n" -ge 3 ]; } && \
      ! grep -rE "fhevmjs|\"fhevm\":" plugins/zama-skills/skills/init/assets/templates/
    </automated>
  </verify>
  <done>5 root-level template files exist, .env example contains all 5 required keys, README hosts deep-link + 3 faucets, no deprecated identifiers anywhere.</done>
</task>

<task type="auto">
  <name>Task 2: Contracts package templates (Hardhat + tsconfig + pkg.json)</name>
  <files>
    plugins/zama-skills/skills/init/assets/templates/packages/contracts/package.json.tpl,
    plugins/zama-skills/skills/init/assets/templates/packages/contracts/hardhat.config.ts.tpl,
    plugins/zama-skills/skills/init/assets/templates/packages/contracts/tsconfig.json.tpl
  </files>
  <action>
**`packages/contracts/package.json.tpl`** — full Hardhat dev stack. Use `@pin:` for every dependency. Required entries (sourced from pinned-versions.json):
- `dependencies`:
  - `@fhevm/solidity`: `<!-- @pin:@fhevm/solidity -->`
  - `@openzeppelin/confidential-contracts`: `<!-- @pin:@openzeppelin/confidential-contracts -->`
  - `@openzeppelin/contracts`: `<!-- @pin:@openzeppelin/contracts -->`
  - `encrypted-types`: `<!-- @pin:encrypted-types -->`
- `devDependencies`:
  - `@fhevm/hardhat-plugin`, `@fhevm/mock-utils`, `@fhevm/host-contracts`,
  - `hardhat`, `ethers`,
  - `@nomicfoundation/hardhat-ethers`, `@nomicfoundation/hardhat-chai-matchers`, `@nomicfoundation/hardhat-network-helpers`, `@nomicfoundation/hardhat-verify`,
  - `hardhat-deploy`, `hardhat-gas-reporter`, `solidity-coverage`,
  - `@typechain/ethers-v6`, `@typechain/hardhat`, `typechain`,
  - `@zama-fhe/relayer-sdk` pinned to `0.4.1` exact via `<!-- @pin:@zama-fhe/relayer-sdk-dev -->` (alias entry in pinned-versions.json),
  - `dotenv`, `cross-env`, `mocha`, `chai`, `chai-as-promised`, `rimraf`, `solhint`, `prettier-plugin-solidity`, `prettier`, `eslint`, `typescript-eslint`,
  - `typescript`: `^5.9.3` (hardcoded — see Task 1 note)
- `scripts`: `compile`, `test`, `coverage`, `clean`, `lint`
- Name: `"contracts"`, private true.

**`packages/contracts/hardhat.config.ts.tpl`** — strict TS, dotenv-loaded:
```ts
import { HardhatUserConfig } from "hardhat/config";
import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const config: HardhatUserConfig = {
  solidity: {
    version: "<!-- @pin:solc -->",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: { chainId: 31337 },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL ?? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY ?? ""}`,
      accounts: process.env.MNEMONIC ? { mnemonic: process.env.MNEMONIC } : [],
      chainId: 11155111,
    },
  },
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY ?? "" },
  typechain: { outDir: "typechain-types", target: "ethers-v6" },
};

export default config;
```
NB: `<!-- @pin:solc -->` resolves to `0.8.27` from pinned-versions.json `compiler.solc`. The 03-04 scaffold.ts must handle this special case (compiler section, not packages section).

**`packages/contracts/tsconfig.json.tpl`** — strict, ESNext target, `noUncheckedIndexedAccess: true`, `outDir: "dist"`, includes `./**/*.ts`, excludes `node_modules`, `dist`, `artifacts`, `cache`.
  </action>
  <verify>
    <automated>
      test -f plugins/zama-skills/skills/init/assets/templates/packages/contracts/package.json.tpl && \
      test -f plugins/zama-skills/skills/init/assets/templates/packages/contracts/hardhat.config.ts.tpl && \
      test -f plugins/zama-skills/skills/init/assets/templates/packages/contracts/tsconfig.json.tpl && \
      grep -q "@fhevm/hardhat-plugin" plugins/zama-skills/skills/init/assets/templates/packages/contracts/hardhat.config.ts.tpl && \
      grep -q "@pin:solc" plugins/zama-skills/skills/init/assets/templates/packages/contracts/hardhat.config.ts.tpl && \
      grep -q "@pin:@fhevm/solidity" plugins/zama-skills/skills/init/assets/templates/packages/contracts/package.json.tpl && \
      grep -q "@pin:@openzeppelin/confidential-contracts" plugins/zama-skills/skills/init/assets/templates/packages/contracts/package.json.tpl && \
      grep -q "@pin:hardhat" plugins/zama-skills/skills/init/assets/templates/packages/contracts/package.json.tpl && \
      grep -q "@pin:ethers" plugins/zama-skills/skills/init/assets/templates/packages/contracts/package.json.tpl && \
      ! grep -rE "fhevmjs|\"fhevm\":" plugins/zama-skills/skills/init/assets/templates/packages/contracts/
    </automated>
  </verify>
  <done>3 contracts-package templates exist, hardhat.config imports @fhevm/hardhat-plugin, all deps use @pin: placeholders, no deprecated names.</done>
</task>

<task type="auto">
  <name>Task 3: Frontend package templates (Vite + React 18)</name>
  <files>
    plugins/zama-skills/skills/init/assets/templates/packages/frontend/package.json.tpl,
    plugins/zama-skills/skills/init/assets/templates/packages/frontend/vite.config.ts.tpl,
    plugins/zama-skills/skills/init/assets/templates/packages/frontend/index.html.tpl,
    plugins/zama-skills/skills/init/assets/templates/packages/frontend/src/main.tsx.tpl,
    plugins/zama-skills/skills/init/assets/templates/packages/frontend/src/App.tsx.tpl
  </files>
  <action>
**`packages/frontend/package.json.tpl`**:
- `dependencies`:
  - `@zama-fhe/relayer-sdk`: `<!-- @pin:@zama-fhe/relayer-sdk -->`
  - `ethers`: `<!-- @pin:ethers -->`
  - `react`: `^18.3.1`
  - `react-dom`: `^18.3.1`
- `devDependencies`:
  - `@types/react`: `^18.3.0`, `@types/react-dom`: `^18.3.0`
  - `@vitejs/plugin-react`: `^4.3.0`, `vite`: `^5.4.0`
  - `typescript`: `^5.9.3`
- `scripts`: `dev`, `build`, `preview`
- Note in JSON comment (or sibling README) that React 18 is pinned per CONTEXT (React 19 untested with relayer-sdk).

**`packages/frontend/vite.config.ts.tpl`** — minimal: react plugin, port 5173.

**`packages/frontend/index.html.tpl`** — basic HTML5 shell with `<div id="root"></div>` and `<script type="module" src="/src/main.tsx"></script>`. Title: `{{USE_CASE_TITLE}} dApp`.

**`packages/frontend/src/main.tsx.tpl`**:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>
);
```

**`packages/frontend/src/App.tsx.tpl`** — minimal placeholder with comment block:
```tsx
// Confidential dApp scaffold — generated by /zama-init.
// Use /zama-frontend (Phase 4) to wire up encryption flows with @zama-fhe/relayer-sdk.
//
// Hard rule: NEVER import fhevmjs. Use @zama-fhe/relayer-sdk only (already in deps).
//
import { useState } from "react";

export default function App() {
  const [connected, setConnected] = useState(false);
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>{{USE_CASE_TITLE}}</h1>
      <p>Confidential dApp scaffold. Run <code>/zama-frontend</code> in Claude Code to wire up encryption.</p>
      <button onClick={() => setConnected(true)}>{connected ? "Connected (placeholder)" : "Connect Wallet"}</button>
    </main>
  );
}
```

NB: `{{USE_CASE_TITLE}}` is a runtime substitution by 03-04, not a @pin.
  </action>
  <verify>
    <automated>
      test -f plugins/zama-skills/skills/init/assets/templates/packages/frontend/package.json.tpl && \
      test -f plugins/zama-skills/skills/init/assets/templates/packages/frontend/vite.config.ts.tpl && \
      test -f plugins/zama-skills/skills/init/assets/templates/packages/frontend/index.html.tpl && \
      test -f plugins/zama-skills/skills/init/assets/templates/packages/frontend/src/main.tsx.tpl && \
      test -f plugins/zama-skills/skills/init/assets/templates/packages/frontend/src/App.tsx.tpl && \
      grep -q "@pin:@zama-fhe/relayer-sdk" plugins/zama-skills/skills/init/assets/templates/packages/frontend/package.json.tpl && \
      grep -q "@pin:ethers" plugins/zama-skills/skills/init/assets/templates/packages/frontend/package.json.tpl && \
      ! grep -rE "fhevmjs" plugins/zama-skills/skills/init/assets/templates/packages/frontend/ && \
      grep -q "react" plugins/zama-skills/skills/init/assets/templates/packages/frontend/package.json.tpl
    </automated>
  </verify>
  <done>5 frontend templates exist, relayer-sdk + ethers via @pin, React 18 pinned, no fhevmjs anywhere.</done>
</task>

</tasks>

<verification>
- 13 .tpl files total, organized under templates/{root-level files} + templates/packages/{contracts,frontend}/
- Every dependency version is a `@pin:<key>` placeholder; concrete versions only in pinned-versions.json (exception: typescript hardcoded ^5.9.3, react/react-dom hardcoded ^18.3.1 — documented in templates).
- Recursive grep for `fhevmjs` and `"fhevm":` returns zero matches.
- `.env.example.tpl` has 5 required keys + comments.
- `root-readme.md.tpl` has chainid.network deep-link + 3 faucet URLs + 30-second value prop.
</verification>

<success_criteria>
- INIT-02 (pinned versions, deprecation-free) — all dep entries use @pin, recursive grep confirms zero deprecated.
- INIT-03 (.env.example) — 5 required keys + comments.
- INIT-04 (MetaMask deep-link) — present in root-readme.md.tpl.
- Templates ready for runtime materialization by 03-04 scaffold.ts.
</success_criteria>

<output>
After completion, create `.planning/phases/03-zama-init-end-to-end/03-02-SUMMARY.md` listing all 13 .tpl files, the @pin keys used, and the runtime substitutions ({{USE_CASE}}, {{USE_CASE_TITLE}}) that 03-04 must implement.
</output>
