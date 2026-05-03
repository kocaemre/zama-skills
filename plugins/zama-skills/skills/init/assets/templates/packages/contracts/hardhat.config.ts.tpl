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

// WR-05: detect whether the user is targeting Sepolia, and if so require
// MNEMONIC. Throwing at config load time gives a pointed error — passing
// `accounts: []` is technically valid hardhat config but produces an
// opaque "no signer for sepolia" failure at deploy time.
const isSepoliaTarget =
  process.argv.includes("sepolia") ||
  process.argv.includes("--network") &&
    process.argv[process.argv.indexOf("--network") + 1] === "sepolia";

if (isSepoliaTarget && !process.env.MNEMONIC) {
  throw new Error(
    "MNEMONIC missing in .env — copy .env.example to .env and fill it before running against sepolia.",
  );
}

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
