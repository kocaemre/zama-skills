/**
 * preflight.ts — Pre-flight checks for `/zama-frontend`.
 *
 * Refuses the generation step when any of:
 *   - workspace `packages/frontend/package.json` missing
 *   - `ethers` is pinned to ^5.x
 *   - `@typechain/ethers-v5` appears in dependencies or devDependencies
 *
 * The migration command is hard-coded into the failure message so callers
 * (the SKILL.md workflow) can pass it through verbatim to the user.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface FrontendPreflightOptions {
  /** Repo root containing `packages/frontend/`. */
  workspaceRoot: string;
}

export interface FrontendPreflightResult {
  ok: boolean;
  failures: string[];
  details: Record<string, string>;
}

const MIGRATION_CMD = "pnpm remove @typechain/ethers-v5 && pnpm add -D @typechain/ethers-v6 ethers@^6";

function looksLikeV5Range(spec: string): boolean {
  // Accept "^5", "^5.x.x", "~5", ">=5 <6", "5.7.0".
  const trimmed = spec.replace(/^[~^>=<\s]+/, "");
  const major = trimmed.split(/[.\s]/)[0];
  return major === "5";
}

export function runFrontendPreflight(opts: FrontendPreflightOptions): FrontendPreflightResult {
  const failures: string[] = [];
  const details: Record<string, string> = {};

  const fePkgPath = join(opts.workspaceRoot, "packages", "frontend", "package.json");
  details["frontendPackagePath"] = fePkgPath;

  if (!existsSync(fePkgPath)) {
    failures.push(
      `packages/frontend/package.json not found at ${fePkgPath}. Run /zama-init first to scaffold the workspace.`,
    );
    return { ok: false, failures, details };
  }

  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(readFileSync(fePkgPath, "utf8")) as typeof pkg;
  } catch (err) {
    failures.push(`Failed to parse ${fePkgPath}: ${(err as Error).message}`);
    return { ok: false, failures, details };
  }

  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

  const ethersSpec = deps["ethers"];
  details["ethers"] = ethersSpec ?? "(missing)";
  if (ethersSpec && looksLikeV5Range(ethersSpec)) {
    failures.push(
      `ethers ${ethersSpec} detected in packages/frontend — fhevm-plugin pins ethers v6. ` +
        `Migrate: ${MIGRATION_CMD}`,
    );
  }

  const tcV5 = deps["@typechain/ethers-v5"];
  details["@typechain/ethers-v5"] = tcV5 ?? "(absent)";
  if (tcV5) {
    failures.push(
      `@typechain/ethers-v5 ${tcV5} detected in packages/frontend — incompatible with relayer-sdk's ethers v6 surface. ` +
        `Migrate: ${MIGRATION_CMD}`,
    );
  }

  return { ok: failures.length === 0, failures, details };
}
