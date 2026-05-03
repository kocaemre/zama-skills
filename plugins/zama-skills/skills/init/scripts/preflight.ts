/**
 * preflight.ts — Pre-flight environment checks for /zama-init.
 *
 * Three checks:
 *   1. Node.js >= 20
 *   2. pnpm available on PATH
 *   3. npm registry reachable (lightweight HEAD probe via Node native https)
 *
 * Exports `runPreflight()` for unit testing (03-06) and exposes a CLI shim
 * that prints a JSON manifest to stdout and a human summary to stderr.
 *
 * No external HTTP libs — uses Node native https + dns to keep the skill
 * runtime dependency-free.
 */

import { spawnSync } from "node:child_process";
import { request } from "node:https";
import { fileURLToPath } from "node:url";
import { argv, exit, stderr, stdout, versions } from "node:process";

export interface PreflightResult {
  ok: boolean;
  failures: string[];
  details: Record<string, string>;
}

export interface PreflightOptions {
  skipNetwork?: boolean;
  /** Override pnpm command (tests). */
  pnpmCmd?: string;
  /** Override Node version string (tests). */
  nodeVersion?: string;
  /** Network probe timeout in ms (default 3000). */
  timeoutMs?: number;
}

const NPM_PING_URL = "https://registry.npmjs.org/-/ping";

function checkNode(nodeVersion: string): {
  ok: boolean;
  detail: string;
  failure?: string;
} {
  const major = Number.parseInt(nodeVersion.split(".")[0] ?? "0", 10);
  if (Number.isNaN(major) || major < 20) {
    return {
      ok: false,
      detail: nodeVersion,
      failure: `Node 20+ required. Found ${nodeVersion}. Install via nvm or asdf.`,
    };
  }
  return { ok: true, detail: nodeVersion };
}

function checkPnpm(pnpmCmd: string): {
  ok: boolean;
  detail: string;
  failure?: string;
} {
  try {
    const res = spawnSync(pnpmCmd, ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (res.error || res.status !== 0) {
      return {
        ok: false,
        detail: "not-found",
        failure:
          "pnpm not found on PATH. Install: npm i -g pnpm@9 (or follow https://pnpm.io/installation).",
      };
    }
    const out = (res.stdout ?? "").trim();
    return { ok: true, detail: out || "unknown" };
  } catch {
    return {
      ok: false,
      detail: "spawn-failed",
      failure:
        "pnpm not found on PATH. Install: npm i -g pnpm@9 (or follow https://pnpm.io/installation).",
    };
  }
}

async function checkInternet(timeoutMs: number): Promise<{
  ok: boolean;
  detail: string;
  failure?: string;
}> {
  return new Promise((resolve) => {
    const url = new URL(NPM_PING_URL);
    const req = request(
      {
        method: "HEAD",
        hostname: url.hostname,
        path: url.pathname,
        port: url.port || 443,
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        res.resume();
        if (status >= 200 && status < 400) {
          resolve({ ok: true, detail: `HTTP ${status}` });
        } else {
          resolve({
            ok: false,
            detail: `HTTP ${status}`,
            failure: `npm registry unreachable (HTTP ${status}). Check internet or proxy settings.`,
          });
        }
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({
        ok: false,
        detail: "timeout",
        failure: `npm registry unreachable (timeout ${timeoutMs}ms). Check internet or proxy settings.`,
      });
    });
    req.on("error", (err: Error) => {
      resolve({
        ok: false,
        detail: err.message,
        failure: `npm registry unreachable (${err.message}). Check internet or proxy settings.`,
      });
    });
    req.end();
  });
}

export async function runPreflight(
  opts: PreflightOptions = {},
): Promise<PreflightResult> {
  const failures: string[] = [];
  const details: Record<string, string> = {};

  const nodeVersion = opts.nodeVersion ?? versions.node;
  const node = checkNode(nodeVersion);
  details["node"] = node.detail;
  if (!node.ok && node.failure) failures.push(node.failure);

  const pnpm = checkPnpm(opts.pnpmCmd ?? "pnpm");
  details["pnpm"] = pnpm.detail;
  if (!pnpm.ok && pnpm.failure) failures.push(pnpm.failure);

  if (opts.skipNetwork) {
    details["internet"] = "skipped";
  } else {
    const net = await checkInternet(opts.timeoutMs ?? 3000);
    details["internet"] = net.detail;
    if (!net.ok && net.failure) failures.push(net.failure);
  }

  return { ok: failures.length === 0, failures, details };
}

// CLI shim — runs only when executed directly via `tsx`.
const isEntry =
  argv[1] !== undefined && fileURLToPath(import.meta.url) === argv[1];

if (isEntry) {
  void runPreflight().then((result) => {
    stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.ok) {
      stderr.write(
        `✓ preflight passed — node=${result.details["node"]}, pnpm=${result.details["pnpm"]}, internet=${result.details["internet"]}\n`,
      );
      exit(0);
    } else {
      stderr.write("✗ preflight failed:\n");
      for (const f of result.failures) {
        stderr.write(`  - ${f}\n`);
      }
      exit(1);
    }
  });
}
