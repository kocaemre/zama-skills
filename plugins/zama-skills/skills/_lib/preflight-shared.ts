/**
 * preflight-shared.ts — Shared preflight primitives for Phase 4 skills.
 *
 * Used by /zama-contract, /zama-test, /zama-deploy, /zama-frontend skills'
 * own `scripts/lib/preflight.ts` to avoid drift on the workspace + tooling
 * checks. Each Phase 4 skill layers its skill-specific checks (e.g. deploy
 * checks chain id, frontend checks typechain v6) on top of these.
 *
 * Public API:
 *   - detectWorkspace(cwd?): walks up looking for pnpm-workspace.yaml,
 *     reports root + presence of packages/contracts and packages/frontend.
 *   - checkPnpm(cmd?): boolean — `cmd --version` succeeds.
 *   - readPkgJson(absPath): parsed package.json or null on missing/invalid.
 *
 * No external deps — Node stdlib only. ESM module.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export interface WorkspaceInfo {
  /** Absolute path to the directory containing pnpm-workspace.yaml, or null. */
  root: string | null;
  /** True if `pnpm` is available on PATH (best-effort). */
  isPnpm: boolean;
  /** True if `<root>/packages/contracts` exists. */
  hasPackagesContracts: boolean;
  /** True if `<root>/packages/frontend` exists. */
  hasPackagesFrontend: boolean;
}

export interface PkgJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Walks up from `cwd` looking for `pnpm-workspace.yaml`. If found, reports
 * the root and probes for `packages/contracts` and `packages/frontend`.
 * Stops at filesystem root.
 */
export function detectWorkspace(cwd: string = process.cwd()): WorkspaceInfo {
  const start = resolve(cwd);
  let dir = start;
  let root: string | null = null;

  // Cap traversal at 32 levels — defensive.
  for (let i = 0; i < 32; i += 1) {
    const candidate = join(dir, "pnpm-workspace.yaml");
    if (existsSync(candidate)) {
      root = dir;
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const hasDir = (p: string): boolean => {
    try {
      return statSync(p).isDirectory();
    } catch {
      return false;
    }
  };

  const isPnpm = root !== null && checkPnpm();
  const hasPackagesContracts =
    root !== null && hasDir(join(root, "packages", "contracts"));
  const hasPackagesFrontend =
    root !== null && hasDir(join(root, "packages", "frontend"));

  return { root, isPnpm, hasPackagesContracts, hasPackagesFrontend };
}

/**
 * True if `cmd --version` runs successfully (default: `pnpm`). Catches
 * spawn errors, non-zero exit codes, and missing-binary errors.
 */
export function checkPnpm(cmd: string = "pnpm"): boolean {
  try {
    const res = spawnSync(cmd, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    if (res.error) return false;
    return res.status === 0;
  } catch {
    return false;
  }
}

/**
 * Reads + parses a package.json at `absPath`. Returns null on missing file
 * or invalid JSON. Never throws.
 */
export function readPkgJson(absPath: string): PkgJson | null {
  try {
    const raw = readFileSync(absPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as PkgJson;
  } catch {
    return null;
  }
}
