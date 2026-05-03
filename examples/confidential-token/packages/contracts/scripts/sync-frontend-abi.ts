/**
 * sync-frontend-abi.ts — copy Token ABI from compiled artifact into the
 * frontend so the dApp can encode calls without re-importing hardhat.
 *
 * Idempotent: running twice writes the same bytes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface SyncResult {
  abiPath: string;
  abiCount: number;
}

export function syncFrontendAbi(opts: { contractsRoot?: string } = {}): SyncResult {
  const root = opts.contractsRoot ?? process.cwd();
  const artifactPath = resolve(
    root,
    "artifacts/contracts/Token.sol/Token.json",
  );
  if (!existsSync(artifactPath)) {
    throw new Error(
      `[sync-frontend-abi] artifact not found at ${artifactPath}. Run \`pnpm hardhat compile\` first.`,
    );
  }
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as {
    abi: unknown[];
    contractName: string;
  };

  const out = resolve(root, "../frontend/lib/abi/Token.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify(
      {
        contractName: artifact.contractName,
        abi: artifact.abi,
      },
      null,
      2,
    ) + "\n",
  );
  return { abiPath: out, abiCount: artifact.abi.length };
}

// CLI shim
const isMain =
  typeof require !== "undefined" && require.main === module;
if (isMain) {
  try {
    const r = syncFrontendAbi();
    console.log(`[sync-frontend-abi] wrote ${r.abiCount} ABI entries → ${r.abiPath}`);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
