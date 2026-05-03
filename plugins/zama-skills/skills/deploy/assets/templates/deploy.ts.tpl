/**
 * deploy/{{NAME}}.ts — Sepolia deploy script for {{NAME}}.
 *
 * Materialized into the user's `packages/contracts/scripts/deploy/`
 * folder by /zama-deploy. Uses ethers v6 via @nomicfoundation/hardhat-ethers
 * (no BigNumber.from — that was ethers v5).
 *
 * Constructor args resolution:
 *   - If `scripts/deploy/{{NAME}}.args.ts` exists and exports a default array,
 *     those args are used.
 *   - Otherwise the contract is deployed with no args.
 *
 * Output contract: this script MUST print exactly one line of the form
 *   `Deployed at: 0x<40 hex>`
 * because the /zama-deploy orchestrator regex-captures that line to wire
 * the address into Etherscan verify, registry registration, and ABI export.
 */

import { ethers, network } from "hardhat";
import { existsSync } from "node:fs";
import { join } from "node:path";

const SEPOLIA_CHAIN_ID = 11155111n;

async function loadArgs(): Promise<unknown[]> {
  const argsPath = join(__dirname, "{{NAME}}.args.ts");
  if (!existsSync(argsPath)) return [];
  const mod = (await import(argsPath)) as { default?: unknown[] };
  return Array.isArray(mod.default) ? mod.default : [];
}

async function main(): Promise<void> {
  // Hard refuse anything that is not Sepolia. Belt-and-braces with the
  // /zama-deploy preflight check; this catches the case where the user
  // runs the deploy script directly outside the skill.
  const net = await ethers.provider.getNetwork();
  if (net.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `ABORT: not Sepolia. Detected ${network.name} (chainId ${net.chainId}). ` +
        `This skill only deploys to Sepolia (chainId 11155111).`,
    );
  }

  const args = await loadArgs();
  const factory = await ethers.getContractFactory("{{NAME}}");
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();

  // Canonical line — DO NOT change format; orchestrator regex depends on it.
  console.log(`Deployed at: ${address}`);
  if (tx?.hash) console.log(`Tx hash: ${tx.hash}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
