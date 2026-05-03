/**
 * preflight.ts — Pre-deploy environment checks for /zama-deploy.
 *
 * Three checks (synchronous, no network):
 *   1. Workspace detect — `packages/contracts/` exists at cwd.
 *   2. Chain-id pin — read `packages/contracts/hardhat.config.ts` and
 *      assert the `sepolia` network has chainId 11155111. Anything
 *      else (mainnet=1, polygon=137, base=8453, …) → ABORT: not Sepolia.
 *   3. Deprecation guard — refuse `hardhat@^3.x` or `ethers@^5` per
 *      `shared/snippets/deprecation-guard.md`.
 *
 * Reading hardhat.config.ts as text (regex) avoids loading the file —
 * which would require running hardhat itself. Skill-level safety net,
 * not a substitute for the runtime chainId check inside deploy.ts.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { argv, cwd, exit, stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";

export interface PreflightOptions {
  cwd?: string;
}

export interface PreflightResult {
  ok: boolean;
  failures: string[];
  details: Record<string, string>;
}

const SEPOLIA_CHAIN_ID = 11155111;

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPkg(path: string): PackageJsonShape | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PackageJsonShape;
  } catch {
    return undefined;
  }
}

function depRange(
  pkg: PackageJsonShape | undefined,
  name: string,
): string | undefined {
  return pkg?.dependencies?.[name] ?? pkg?.devDependencies?.[name];
}

/** Returns true if a npm range string starts with the given major version. */
function rangeStartsWithMajor(range: string, major: number): boolean {
  // Strip leading ^ ~ >= > = v
  const stripped = range.replace(/^[\^~>=<v\s]+/, "");
  const m = stripped.match(/^(\d+)/);
  if (!m) return false;
  return Number.parseInt(m[1] as string, 10) === major;
}

function extractSepoliaChainId(configText: string): number | undefined {
  // Find the sepolia network block, then capture the first chainId number after it.
  const idx = configText.indexOf("sepolia");
  if (idx < 0) return undefined;
  const window = configText.slice(idx, idx + 512);
  const m = window.match(/chainId\s*:\s*(\d+)/);
  if (!m) return undefined;
  return Number.parseInt(m[1] as string, 10);
}

export function runPreflight(opts: PreflightOptions = {}): PreflightResult {
  const root = opts.cwd ?? cwd();
  const failures: string[] = [];
  const details: Record<string, string> = {};

  const contractsDir = join(root, "packages/contracts");
  if (!existsSync(contractsDir)) {
    failures.push(
      "workspace not found: packages/contracts/ missing. Run /zama-init first to scaffold the project.",
    );
    details["workspace"] = "missing";
    return { ok: false, failures, details };
  }
  details["workspace"] = "ok";

  // Deprecation guard
  const pkg = readPkg(join(contractsDir, "package.json"));
  const hardhatRange = depRange(pkg, "hardhat");
  const ethersRange = depRange(pkg, "ethers");
  details["hardhat"] = hardhatRange ?? "missing";
  details["ethers"] = ethersRange ?? "missing";
  if (hardhatRange && rangeStartsWithMajor(hardhatRange, 3)) {
    failures.push(
      `hardhat ${hardhatRange} is incompatible — fhevm-plugin peer-dep is hardhat@^2.0.0. Pin hardhat@^2.28.4.`,
    );
  }
  if (ethersRange && rangeStartsWithMajor(ethersRange, 5)) {
    failures.push(
      `ethers ${ethersRange} is incompatible — fhevm-plugin pins ethers v6. Pin ethers@^6.16.0.`,
    );
  }

  // Chain-id check
  const configPath = join(contractsDir, "hardhat.config.ts");
  if (!existsSync(configPath)) {
    failures.push(
      "hardhat.config.ts not found in packages/contracts/. Cannot verify Sepolia chainId.",
    );
    details["chainId"] = "unknown";
  } else {
    const text = readFileSync(configPath, "utf8");
    const id = extractSepoliaChainId(text);
    details["chainId"] = id !== undefined ? String(id) : "missing";
    if (id === undefined) {
      failures.push(
        "hardhat.config.ts: no sepolia network with chainId. Add networks.sepolia.chainId = 11155111.",
      );
    } else if (id !== SEPOLIA_CHAIN_ID) {
      failures.push(
        `ABORT: not Sepolia. hardhat.config.ts has networks.sepolia.chainId=${id}, expected ${SEPOLIA_CHAIN_ID}.`,
      );
    }
  }

  return { ok: failures.length === 0, failures, details };
}

// CLI shim
const isEntry =
  argv[1] !== undefined && fileURLToPath(import.meta.url) === argv[1];
if (isEntry) {
  const r = runPreflight();
  stdout.write(JSON.stringify(r, null, 2) + "\n");
  if (r.ok) {
    stderr.write(
      `✓ preflight passed — workspace=${r.details["workspace"]}, chainId=${r.details["chainId"]}, hardhat=${r.details["hardhat"]}, ethers=${r.details["ethers"]}\n`,
    );
    exit(0);
  }
  stderr.write("✗ preflight failed:\n");
  for (const f of r.failures) stderr.write(`  - ${f}\n`);
  exit(1);
}
