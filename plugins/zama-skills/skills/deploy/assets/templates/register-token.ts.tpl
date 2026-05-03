/**
 * scripts/register-token.ts — Confidential Token Registry registration on Sepolia.
 *
 * Materialized by /zama-deploy Step 5 ONLY when the contract source
 * matches `is ERC7984`. The orchestrator passes the registry address
 * and the freshly-deployed token address via env vars rather than
 * baking them into the template — so this file contains NO pinned
 * Sepolia hex addresses.
 *
 * Required env (set by /zama-deploy before invoking):
 *   ZAMA_TOKEN_REGISTRY  — Confidential Token Registry address
 *                           (from getSepoliaAddresses, live WebFetch)
 *   ZAMA_TOKEN_ADDRESS   — the deployed ERC7984 token address
 *
 * Output: prints `Registered tx: 0x<64 hex>` so the orchestrator can
 * include the tx URL in the closing summary.
 */

import { ethers, network } from "hardhat";

const SEPOLIA_CHAIN_ID = 11155111n;

const REGISTRY_ABI = [
  "function registerToken(address token) external returns (bytes32)",
];

async function registerToken(): Promise<void> {
  const net = await ethers.provider.getNetwork();
  if (net.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `ABORT: not Sepolia. Detected ${network.name} (chainId ${net.chainId}).`,
    );
  }

  const registryAddress = process.env["ZAMA_TOKEN_REGISTRY"];
  const tokenAddress = process.env["ZAMA_TOKEN_ADDRESS"];
  if (!registryAddress || !tokenAddress) {
    throw new Error(
      "register-token: ZAMA_TOKEN_REGISTRY and ZAMA_TOKEN_ADDRESS must be set " +
        "(populated by /zama-deploy from the live address registry).",
    );
  }

  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("register-token: no signer available.");

  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, signer);
  const tx = await registry["registerToken"](tokenAddress);
  console.log(`Registering ${tokenAddress} with ${registryAddress}…`);
  const receipt = await tx.wait();
  console.log(`Registered tx: ${receipt?.hash ?? tx.hash}`);
}

registerToken().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
