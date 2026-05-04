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
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.deploy.local FIRST (gitignored, holds the funded deploy key) so
// it takes precedence over the public .env.
//
// Resolution order:
//   1) DEPLOY_ENV_FILE env var (explicit override — wins always)
//   2) examples/confidential-token/.env.deploy.local (per-example, the standard)
//   3) walk upward from this file, looking in each parent dir for
//      `.env.deploy.local` (handles worktrees, monorepos, repo-root placement)
const candidates: string[] = [];
if (process.env.DEPLOY_ENV_FILE) candidates.push(process.env.DEPLOY_ENV_FILE);
candidates.push(resolve(__dirname, "../../.env.deploy.local"));
{
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    candidates.push(resolve(dir, ".env.deploy.local"));
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
}
for (const p of candidates) {
  if (existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}
// Then load the regular env (does NOT override anything already set above).
dotenv.config({ path: resolve(__dirname, "../../.env") });

// Resolve a deploy key — prefer DEPLOYER_PRIVATE_KEY (.env.deploy.local
// canonical), fall back to PRIVATE_KEY, then MNEMONIC.
const PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? "";
const MNEMONIC = process.env.DEPLOYER_MNEMONIC ?? process.env.MNEMONIC ?? "";

const isSepoliaTarget =
  process.argv.includes("sepolia") ||
  (process.argv.includes("--network") &&
    process.argv[process.argv.indexOf("--network") + 1] === "sepolia");

if (isSepoliaTarget && !PRIVATE_KEY && !MNEMONIC) {
  throw new Error(
    "No deploy credentials found. Provide DEPLOYER_PRIVATE_KEY (preferred) " +
      "or MNEMONIC in .env.deploy.local before targeting sepolia.",
  );
}

const sepoliaRpc =
  process.env.SEPOLIA_RPC_URL ||
  (process.env.INFURA_API_KEY
    ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
    : "https://ethereum-sepolia.publicnode.com");

const sepoliaAccounts: string[] | { mnemonic: string } = PRIVATE_KEY
  ? [PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`]
  : MNEMONIC
    ? { mnemonic: MNEMONIC }
    : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: { chainId: 31337 },
    sepolia: {
      url: sepoliaRpc,
      accounts: sepoliaAccounts,
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY ?? "",
  },
  namedAccounts: { deployer: { default: 0 } },
  typechain: { outDir: "typechain-types", target: "ethers-v6" },
};

export default config;
