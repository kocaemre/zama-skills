/**
 * deploy.ts — One-command Sepolia deploy + verify + register + sync ABI for
 * the ERC-7984 confidential `Token` contract.
 *
 * Usage:
 *   pnpm hardhat run --network sepolia scripts/deploy.ts
 *
 * Idempotent: re-running with an existing deployments/sepolia/Token.json
 * skips the deploy step and reuses the recorded address (use --force to
 * redeploy via the FORCE_REDEPLOY env var).
 *
 * Steps:
 *   1. Resolve Sepolia infra addresses LIVE from docs.zama.org
 *   2. Deploy Token(name, symbol, uri)
 *   3. Wait 5 confirmations
 *   4. Verify on Etherscan (skipped gracefully if ETHERSCAN_API_KEY missing)
 *   5. Attempt registration with Zama Wrappers Registry (skipped on revert)
 *   6. Persist deployments/sepolia/Token.json
 *   7. Sync ABI into frontend
 *   8. Print human-readable summary suitable for DEPLOYED.md
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { ethers } from "ethers";
import * as hre from "hardhat";

import { getZamaAddresses } from "./lib/zama-addresses";
import { registerWithRegistry } from "./register-with-registry";
import { syncFrontendAbi } from "./sync-frontend-abi";

const TOKEN_NAME = "Confidential Demo Token";
const TOKEN_SYMBOL = "cDEMO";
const TOKEN_URI = "https://github.com/zama-ai/zama-skills";
const CONFIRMATIONS = 5;

interface DeploymentRecord {
  network: string;
  chainId: number;
  address: string;
  deployer: string;
  transactionHash: string;
  blockNumber: number;
  blockTimestamp: number;
  args: { name: string; symbol: string; uri: string };
  abi: unknown[];
  verification?: { status: "verified" | "skipped" | "failed"; detail?: string };
  registry?: {
    address: string;
    txHash?: string;
    skippedReason?: string;
  };
  zamaAddresses?: Record<string, string | undefined>;
  fetchedAt: string;
}

function deploymentPath(): string {
  return resolve(
    process.cwd(),
    "deployments",
    "sepolia",
    "Token.json",
  );
}

function banner(label: string): void {
  // eslint-disable-next-line no-console
  console.log(`\n━━━ ${label} ${"━".repeat(Math.max(0, 70 - label.length))}`);
}

async function main(): Promise<void> {
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 11155111) {
    throw new Error(
      `Refusing to run: connected chainId=${chainId} (expected 11155111 sepolia).`,
    );
  }

  const signers = await hre.ethers.getSigners();
  const signer = signers[0];
  if (!signer) {
    throw new Error(
      "No signer available — ensure DEPLOYER_PRIVATE_KEY (or MNEMONIC) is set in .env.deploy.local",
    );
  }
  const deployer = await signer.getAddress();
  const balance = await hre.ethers.provider.getBalance(deployer);
  // eslint-disable-next-line no-console
  console.log(`Deployer: ${deployer}`);
  // eslint-disable-next-line no-console
  console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);

  // Idempotency guard
  const recordPath = deploymentPath();
  if (existsSync(recordPath) && !process.env.FORCE_REDEPLOY) {
    const existing = JSON.parse(readFileSync(recordPath, "utf8")) as DeploymentRecord;
    if (existing.address && /^0x[0-9a-fA-F]{40}$/.test(existing.address)) {
      // eslint-disable-next-line no-console
      console.log(
        `\n[idempotent] Token already deployed at ${existing.address} (block ${existing.blockNumber}).`,
      );
      // eslint-disable-next-line no-console
      console.log(
        `[idempotent] Set FORCE_REDEPLOY=1 to redeploy. Re-syncing ABI + frontend env now.`,
      );
      const sync = syncFrontendAbi();
      // eslint-disable-next-line no-console
      console.log(`[sync] ABI written to ${sync.abiPath} (${sync.abiCount} entries)`);
      updateFrontendEnv(existing.address);
      writeDeployedMarkdown(existing);
      return;
    }
  }

  banner("STEP 1 — Resolving Sepolia infra addresses (live)");
  let zamaAddrs: Awaited<ReturnType<typeof getZamaAddresses>> = {};
  try {
    zamaAddrs = await getZamaAddresses();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(zamaAddrs, null, 2));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[zama-addresses] live fetch failed: ${(err as Error).message}`);
    // Non-blocking — registration is best-effort.
  }

  banner("STEP 2 — Deploying Token");
  const Token = await hre.ethers.getContractFactory("Token", signer);
  const t0 = Date.now();
  const token = await Token.deploy(TOKEN_NAME, TOKEN_SYMBOL, TOKEN_URI);
  const deployTx = token.deploymentTransaction();
  if (!deployTx) throw new Error("deploymentTransaction() returned null");
  // eslint-disable-next-line no-console
  console.log(`Deploy tx submitted: ${deployTx.hash}`);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  // eslint-disable-next-line no-console
  console.log(`Token deployed at: ${tokenAddress} (${Date.now() - t0} ms)`);

  banner(`STEP 3 — Waiting ${CONFIRMATIONS} confirmations`);
  const receipt = await deployTx.wait(CONFIRMATIONS);
  if (!receipt) throw new Error("deploy tx receipt missing");
  // eslint-disable-next-line no-console
  console.log(
    `Mined in block ${receipt.blockNumber}, gas used: ${receipt.gasUsed.toString()}`,
  );
  const block = await hre.ethers.provider.getBlock(receipt.blockNumber);
  const blockTimestamp = block?.timestamp ?? Math.floor(Date.now() / 1000);

  banner("STEP 4 — Etherscan verify");
  const verification = await runVerify(tokenAddress, [TOKEN_NAME, TOKEN_SYMBOL, TOKEN_URI]);
  // eslint-disable-next-line no-console
  console.log(`Verify status: ${verification.status}${verification.detail ? ` — ${verification.detail}` : ""}`);

  banner("STEP 5 — Registry registration (best-effort)");
  const registry = await registerWithRegistry(signer, tokenAddress, undefined);
  if (registry.txHash) {
    // eslint-disable-next-line no-console
    console.log(`Registry tx: ${registry.txHash}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`Registry skipped: ${registry.skippedReason}`);
  }

  banner("STEP 6 — Writing deployment record");
  const artifact = await hre.artifacts.readArtifact("Token");
  const record: DeploymentRecord = {
    network: "sepolia",
    chainId,
    address: tokenAddress,
    deployer,
    transactionHash: deployTx.hash,
    blockNumber: receipt.blockNumber,
    blockTimestamp,
    args: { name: TOKEN_NAME, symbol: TOKEN_SYMBOL, uri: TOKEN_URI },
    abi: artifact.abi,
    verification,
    registry: {
      address: registry.registry,
      txHash: registry.txHash,
      skippedReason: registry.skippedReason,
    },
    zamaAddresses: zamaAddrs as Record<string, string | undefined>,
    fetchedAt: new Date().toISOString(),
  };
  mkdirSync(dirname(recordPath), { recursive: true });
  writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${recordPath}`);

  banner("STEP 7 — Syncing ABI into frontend");
  const sync = syncFrontendAbi();
  // eslint-disable-next-line no-console
  console.log(`ABI written to ${sync.abiPath} (${sync.abiCount} entries)`);

  banner("STEP 8 — Updating env example + DEPLOYED.md");
  updateFrontendEnv(tokenAddress);
  writeDeployedMarkdown(record);
  // eslint-disable-next-line no-console
  console.log("\nDONE.");
  // eslint-disable-next-line no-console
  console.log(`Etherscan: https://sepolia.etherscan.io/address/${tokenAddress}#code`);
}

async function runVerify(
  address: string,
  args: unknown[],
): Promise<{ status: "verified" | "skipped" | "failed"; detail?: string }> {
  if (!process.env.ETHERSCAN_API_KEY) {
    const msg =
      "ETHERSCAN_API_KEY missing — skipping verify; user must run `pnpm hardhat verify --network sepolia <addr> <args>` later";
    // eslint-disable-next-line no-console
    console.warn(msg);
    return { status: "skipped", detail: msg };
  }
  try {
    await hre.run("verify:verify", { address, constructorArguments: args });
    return { status: "verified" };
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    if (/already verified/i.test(msg)) {
      return { status: "verified", detail: "already verified" };
    }
    // eslint-disable-next-line no-console
    console.warn(`verify failed: ${msg}`);
    return { status: "failed", detail: msg.split("\n")[0] };
  }
}

function updateFrontendEnv(address: string): void {
  const envPath = resolve(
    process.cwd(),
    "..",
    "frontend",
    ".env.local.example",
  );
  if (!existsSync(envPath)) {
    // eslint-disable-next-line no-console
    console.warn(`[env] ${envPath} not found — skipping`);
    return;
  }
  const lines = readFileSync(envPath, "utf8").split("\n");
  const key = "NEXT_PUBLIC_CONTRACT_ADDRESS";
  let touched = false;
  const out = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      touched = true;
      return `${key}=${address}`;
    }
    return line;
  });
  if (!touched) {
    out.push(`${key}=${address}`);
  }
  writeFileSync(envPath, out.join("\n"));
  // eslint-disable-next-line no-console
  console.log(`Updated ${envPath} with ${key}=${address}`);
}

function writeDeployedMarkdown(record: DeploymentRecord): void {
  const out = resolve(process.cwd(), "..", "..", "DEPLOYED.md");
  const etherscan = `https://sepolia.etherscan.io/address/${record.address}`;
  const txUrl = `https://sepolia.etherscan.io/tx/${record.transactionHash}`;
  const verifyLine =
    record.verification?.status === "verified"
      ? `Verified: yes${record.verification.detail ? ` (${record.verification.detail})` : ""}`
      : `Verified: ${record.verification?.status ?? "unknown"}${record.verification?.detail ? ` — ${record.verification.detail}` : ""}`;
  const registryLine = record.registry?.txHash
    ? `Registry tx: [${record.registry.txHash}](https://sepolia.etherscan.io/tx/${record.registry.txHash})`
    : `Registry: skipped — ${record.registry?.skippedReason ?? "n/a"}`;
  const md = `# Confidential Demo Token — Sepolia Deployment

> Generated by \`scripts/deploy.ts\`. Re-run \`pnpm hardhat run --network sepolia scripts/deploy.ts\` to refresh.

| Field | Value |
| --- | --- |
| Address | [\`${record.address}\`](${etherscan}#code) |
| Name | ${record.args.name} |
| Symbol | ${record.args.symbol} |
| Network | Sepolia (chainId ${record.chainId}) |
| Deployer | [\`${record.deployer}\`](https://sepolia.etherscan.io/address/${record.deployer}) |
| Deploy tx | [\`${record.transactionHash}\`](${txUrl}) |
| Block | ${record.blockNumber} |
| Timestamp | ${new Date(record.blockTimestamp * 1000).toISOString()} |

## Verification

${verifyLine}

Etherscan: <${etherscan}#code>

## Registry

${registryLine}

Wrappers Registry source-of-truth: <https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia>

## How to redeploy

\`\`\`bash
cd packages/contracts
FORCE_REDEPLOY=1 pnpm hardhat run --network sepolia scripts/deploy.ts
\`\`\`

## How to manually verify (if skipped)

\`\`\`bash
ETHERSCAN_API_KEY=<key> \\
  pnpm hardhat verify --network sepolia ${record.address} \\
  "${record.args.name}" "${record.args.symbol}" "${record.args.uri}"
\`\`\`
`;
  writeFileSync(out, md);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${out}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
