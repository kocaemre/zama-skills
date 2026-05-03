/**
 * preflight.ts — environment check for /zama-contract.
 *
 * Verifies that the active workspace was scaffolded by /zama-init:
 *   - `packages/contracts/` directory exists and is writable
 *   - root `package.json` lists `@fhevm/solidity` (deps OR devDeps)
 *
 * Plan 04-01, Task 2.
 */

import { existsSync, readFileSync, accessSync, constants } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, exit, stderr, stdout } from "node:process";

export interface PreflightOptions {
  /** Working directory to check; defaults to process.cwd(). */
  cwd?: string;
}

export interface PreflightResult {
  ok: boolean;
  error?: string;
  details?: Record<string, string>;
}

const RUN_INIT_FIRST =
  "Run /zama-init first to scaffold the project (packages/contracts/ + @fhevm/solidity).";

export function preflight(opts: PreflightOptions = {}): PreflightResult {
  const cwd = resolve(opts.cwd ?? process.cwd());
  const contractsDir = resolve(cwd, "packages", "contracts", "contracts");

  if (!existsSync(contractsDir)) {
    return {
      ok: false,
      error: `${RUN_INIT_FIRST}\n  Missing: ${contractsDir}`,
    };
  }

  try {
    accessSync(contractsDir, constants.W_OK);
  } catch {
    return {
      ok: false,
      error: `packages/contracts/contracts is not writable: ${contractsDir}`,
    };
  }

  const pkgPath = resolve(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    return {
      ok: false,
      error: `${RUN_INIT_FIRST}\n  Missing: ${pkgPath}`,
    };
  }

  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch (err) {
    return {
      ok: false,
      error: `Failed to parse package.json at ${pkgPath}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  const allDeps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };
  if (!allDeps["@fhevm/solidity"]) {
    return {
      ok: false,
      error:
        `@fhevm/solidity is not listed in package.json dependencies.\n  ${RUN_INIT_FIRST}`,
    };
  }

  return {
    ok: true,
    details: {
      contractsDir,
      "@fhevm/solidity": allDeps["@fhevm/solidity"],
    },
  };
}

// CLI shim — when invoked directly via `node preflight.ts`.
const isDirectInvocation =
  argv[1] !== undefined &&
  resolve(argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectInvocation) {
  const r = preflight();
  if (r.ok) {
    stdout.write(`preflight ok\n${JSON.stringify(r.details, null, 2)}\n`);
    exit(0);
  }
  stderr.write(`preflight failed: ${r.error ?? "unknown error"}\n`);
  exit(1);
}
