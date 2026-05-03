/**
 * preflight.ts — pre-flight checks for /zama-test.
 *
 * Verifies (in order):
 *   1. `packages/contracts/contracts/` exists in the workspace (else /zama-init not run).
 *   2. The target contract `<Name>.sol` exists in that directory.
 *   3. `packages/contracts/package.json` does NOT pin ethers ^5 or use @typechain/ethers-v5
 *      (TEST mitigation T-04-08 — refuse to emit ethers v5 syntax).
 *
 * Pure (no network IO). Safe to call from generate.ts.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { argv, exit, stderr, stdout, cwd as processCwd } from "node:process";
import { fileURLToPath } from "node:url";

export interface TestPreflightOptions {
  cwd?: string;
  contract: string;
}

export interface TestPreflightResult {
  ok: boolean;
  failures: string[];
  details: Record<string, string>;
}

const ETHERS_V5_RE = /^[~^]?5\./;

function isEthersV5(versionRange: string): boolean {
  // Accept ranges like ^5.x.y, ~5.x, 5.7.2, >=5 <6, etc. Catch the common forms.
  const trimmed = versionRange.trim();
  if (ETHERS_V5_RE.test(trimmed)) return true;
  if (/^>=?\s*5(\.|$)/.test(trimmed) && !/[6-9]/.test(trimmed)) return true;
  return false;
}

export async function runTestPreflight(opts: TestPreflightOptions): Promise<TestPreflightResult> {
  const root = opts.cwd ?? processCwd();
  const failures: string[] = [];
  const details: Record<string, string> = {};

  const contractsDir = join(root, "packages", "contracts", "contracts");
  details["contractsDir"] = contractsDir;

  if (!existsSync(contractsDir)) {
    failures.push("packages/contracts/contracts/ not found. Run /zama-init first to scaffold the project.");
    return { ok: false, failures, details };
  }

  const targetSol = join(contractsDir, `${opts.contract}.sol`);
  details["targetSol"] = targetSol;
  if (!existsSync(targetSol)) {
    failures.push(`${opts.contract}.sol not found in packages/contracts/contracts/`);
  }

  const pkgPath = join(root, "packages", "contracts", "package.json");
  details["pkgPath"] = pkgPath;
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      const ethersRange = allDeps["ethers"];
      if (typeof ethersRange === "string" && isEthersV5(ethersRange)) {
        failures.push(`ethers v5 detected; /zama-test requires ethers v6 (found ethers@${ethersRange} in packages/contracts/package.json)`);
      }
      if ("@typechain/ethers-v5" in allDeps) {
        failures.push("@typechain/ethers-v5 detected; /zama-test requires @typechain/ethers-v6 (ethers v5 toolchain is incompatible with @fhevm/hardhat-plugin)");
      }
    } catch (err) {
      failures.push(`Could not parse packages/contracts/package.json: ${(err as Error).message}`);
    }
  }

  return { ok: failures.length === 0, failures, details };
}

// CLI shim
const isEntry = argv[1] !== undefined && fileURLToPath(import.meta.url) === argv[1];
if (isEntry) {
  const contractIdx = argv.indexOf("--contract");
  const contract = contractIdx >= 0 ? argv[contractIdx + 1] : undefined;
  if (!contract) {
    stderr.write("usage: tsx preflight.ts --contract <Name>\n");
    exit(2);
  }
  void runTestPreflight({ contract }).then((r) => {
    stdout.write(JSON.stringify(r, null, 2) + "\n");
    if (r.ok) {
      stderr.write(`✓ /zama-test preflight passed\n`);
      exit(0);
    } else {
      stderr.write(`✗ /zama-test preflight failed:\n`);
      for (const f of r.failures) stderr.write(`  - ${f}\n`);
      exit(1);
    }
  });
}
