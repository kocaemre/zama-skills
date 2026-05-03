<!-- Generated from pinned-versions.json — do not edit manually; run `pnpm sync` to regenerate. -->

# Pinned Zama Stack Versions

The following versions are the authoritative pin set for this plugin. They were verified via direct `npm view` queries against the npm registry on **2026-05-03** and cross-checked against the `fhevm-hardhat-template` `package.json` for peer-dep alignment.

| Package | Version | Notes |
|---------|---------|-------|
| `@fhevm/solidity` | `<!-- @pin:@fhevm/solidity -->` | Solidity FHE library. Replaces deprecated `fhevm` (root pkg). OZ confidential pins this exactly. |
| `@fhevm/hardhat-plugin` | `<!-- @pin:@fhevm/hardhat-plugin -->` | Mock encrypt/decrypt + local FHE node for tests. |
| `@fhevm/mock-utils` | `<!-- @pin:@fhevm/mock-utils -->` | Exact-version peer of hardhat-plugin. |
| `@fhevm/host-contracts` | `<!-- @pin:@fhevm/host-contracts -->` | Pulled in transitively by hardhat-plugin. |
| `@zama-fhe/relayer-sdk` | `<!-- @pin:@zama-fhe/relayer-sdk -->` | Frontend SDK. Replaces deprecated `fhevmjs`. Use exact `0.4.1` in devDeps to match plugin peer; `^0.4.2` in frontend deps. |
| `@openzeppelin/confidential-contracts` | `<!-- @pin:@openzeppelin/confidential-contracts -->` | ERC-7984, VotesConfidential, FHESafeMath. |
| `@openzeppelin/contracts` | `<!-- @pin:@openzeppelin/contracts -->` | Required peer of confidential-contracts. |
| `@openzeppelin/contracts-upgradeable` | `<!-- @pin:@openzeppelin/contracts-upgradeable -->` | Optional, paired with above. |
| `encrypted-types` | `<!-- @pin:encrypted-types -->` | Shared TS types for encrypted handles. |
| `ethers` | `<!-- @pin:ethers -->` | v6 only — fhevm plugin pins v6 and v5 will mismatch typechain output. |
| `hardhat` | `<!-- @pin:hardhat -->` | v2 line. fhevm plugin peer-deps `hardhat@^2.0.0`. Do NOT use Hardhat 3 yet. |
| `solc` | `<!-- @pin:solc -->` | Compiler version pinned by template (supports `^0.8.24+`). |
| Node.js | `>=20` | Matches fhevm-hardhat-template engines field. LTS, ESM-first. |

## Deprecated — do not use

| Package | Last Version | Replacement |
|---------|-------------|-------------|
| `fhevmjs` | `0.6.2` (deprecated 2025-07-10) | `@zama-fhe/relayer-sdk` |
| `fhevm` (root pkg) | `0.6.2` (deprecated 2025-07-10) | `@fhevm/solidity` |

## Incompatible — do not use yet

| Package | Reason |
|---------|--------|
| `hardhat@^3.x` | fhevm plugin peer-dep is `hardhat@^2.0.0`; v3 breaking config changes. Revisit Q3 2026. |
| `ethers@^5` | fhevm plugin pins ethers v6; v5 mismatches typechain output. |
