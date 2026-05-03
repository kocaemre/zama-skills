/**
 * abi-export.ts — Reads a Hardhat artifact and writes a frontend-friendly
 * `{abi, bytecode, address, network}` JSON to packages/frontend/src/abis/.
 *
 * Step 6 of /zama-deploy. Runs after Step 4 (verify) so the on-chain
 * address is known and the frontend can be wired immediately.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { argv, cwd, exit, stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";

export interface ExportOptions {
  /** Project root. Defaults to process.cwd(). */
  cwd?: string;
  /** Network label (defaults to 'sepolia'). */
  network?: string;
}

export interface ExportedAbi {
  abi: unknown[];
  bytecode: string;
  address: string;
  network: string;
}

interface HardhatArtifact {
  abi: unknown[];
  bytecode: string;
  contractName?: string;
}

/**
 * Read `<cwd>/artifacts/contracts/<Name>.sol/<Name>.json` (or, when
 * the project is a pnpm workspace, also try `<cwd>/packages/contracts/`),
 * write `<cwd>/packages/frontend/src/abis/<Name>.json`. Returns the
 * absolute output path.
 */
export function exportAbi(
  name: string,
  address: string,
  opts: ExportOptions = {},
): string {
  const root = opts.cwd ?? cwd();
  const network = opts.network ?? "sepolia";

  const candidates = [
    join(root, "artifacts/contracts", `${name}.sol`, `${name}.json`),
    join(
      root,
      "packages/contracts/artifacts/contracts",
      `${name}.sol`,
      `${name}.json`,
    ),
  ];
  const artifactPath = candidates.find((p) => existsSync(p));
  if (!artifactPath) {
    throw new Error(
      `Artifact not found for ${name} (looked in: ${candidates.join(", ")}). ` +
        `Run pnpm hardhat compile first.`,
    );
  }

  const raw = JSON.parse(readFileSync(artifactPath, "utf8")) as HardhatArtifact;
  if (!Array.isArray(raw.abi) || typeof raw.bytecode !== "string") {
    throw new Error(
      `Artifact at ${artifactPath} is malformed (missing abi or bytecode). ` +
        `Run pnpm hardhat compile first.`,
    );
  }

  const out: ExportedAbi = {
    abi: raw.abi,
    bytecode: raw.bytecode,
    address,
    network,
  };

  const outPath = join(root, "packages/frontend/src/abis", `${name}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  return outPath;
}

// CLI shim
const isEntry =
  argv[1] !== undefined && fileURLToPath(import.meta.url) === argv[1];
if (isEntry) {
  const [name, address] = argv.slice(2);
  if (!name || !address) {
    stderr.write("Usage: abi-export.ts <ContractName> <0xAddress>\n");
    exit(2);
  }
  try {
    const p = exportAbi(name, address);
    stdout.write(p + "\n");
    exit(0);
  } catch (e) {
    stderr.write(`✗ abi-export: ${e instanceof Error ? e.message : String(e)}\n`);
    exit(1);
  }
}
