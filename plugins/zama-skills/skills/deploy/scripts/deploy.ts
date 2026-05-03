/**
 * deploy.ts — /zama-deploy 7-step orchestrator.
 *
 * Strict ordering (each gate aborts the rest):
 *   Step 0  Confirmation (handled by skill body — assumed accepted here)
 *   Step 0b preflight: workspace + chainId 11155111 + non-deprecated deps
 *   Step 1  env-validate: SEPOLIA_RPC_URL, ETHERSCAN_API_KEY, MNEMONIC|PRIVATE_KEY
 *   Step 2  pnpm hardhat compile
 *   Step 3  pnpm hardhat run --network sepolia scripts/deploy/<Name>.ts
 *           — captures `Deployed at: 0x[40hex]` from stdout
 *   Step 4  pnpm hardhat verify --network sepolia <addr> <args...>
 *           — single retry on rate limit; failure does not abort
 *   Step 5  Confidential Token Registry registration (only if `is ERC7984`
 *           appears in the contract source). Looks up registry address via
 *           getSepoliaAddresses (live WebFetch, 24h cached).
 *   Step 6  abi-export → packages/frontend/src/abis/<Name>.json
 *   Step 7  closing summary string
 *
 * The actual Bash invocations are funneled through an injectable `exec`
 * (defaults to child_process.execSync) so unit tests can stub the whole
 * flow without spawning processes.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { argv, cwd, env as procEnv, exit, stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";

import { validateEnv, parseDotenv } from "./lib/env-validate.js";
import { runPreflight } from "./lib/preflight.js";
import { exportAbi } from "./lib/abi-export.js";
import {
  REGISTRY_URL,
  getSepoliaAddresses,
} from "./lib/sepolia-addresses.js";

export interface RunDeployOptions {
  contract: string;
  args?: string[];
  /** Pre-merged env (from .env + process.env). Defaults to process.env. */
  env?: Record<string, string | undefined>;
  /** Project root. Defaults to process.cwd(). */
  cwd?: string;
  /** Bash invoker. Defaults to child_process.execSync. */
  exec?: (cmd: string, opts?: { cwd?: string }) => string;
  /** WebFetch fn for sepolia-addresses (used in tests). */
  fetcher?: () => Promise<string>;
}

export interface RunDeployResult {
  ok: boolean;
  address?: string;
  txHash?: string;
  registryTxHash?: string;
  abiPath?: string;
  summary?: string;
  /** Set when Step 1 fails. */
  missingEnv?: string[];
  /** Set when preflight fails. */
  preflightFailures?: string[];
  /** Set on any other failure. */
  error?: string;
}

const DEPLOY_LINE = /Deployed at:\s*(0x[a-fA-F0-9]{40})/;
const TX_LINE = /(?:Tx|tx|Transaction|transaction)(?:\s*hash)?:\s*(0x[a-fA-F0-9]{64})/;
const REGISTRY_TX_LINE = /Registered\s+tx:\s*(0x[a-fA-F0-9]{64})/;

function defaultExec(cmd: string, opts?: { cwd?: string }): string {
  return execSync(cmd, {
    cwd: opts?.cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function detectErc7984(root: string, name: string): boolean {
  const candidates = [
    join(root, "packages/contracts/contracts", `${name}.sol`),
    join(root, "contracts", `${name}.sol`),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      const src = readFileSync(p, "utf8");
      if (/\bis\s+ERC7984\b/.test(src)) return true;
    }
  }
  return false;
}

function workspaceCwd(root: string): string {
  // Hardhat commands must run inside packages/contracts/ when present.
  const sub = join(root, "packages/contracts");
  return existsSync(sub) ? sub : root;
}

function snakeUpper(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

function formatSummary(args: {
  name: string;
  address: string;
  txHash?: string;
  registryTxHash?: string;
  registrySkipped: boolean;
  abiPath: string;
  verifySkipped?: string;
}): string {
  const upper = snakeUpper(args.name);
  const verifyLine = args.verifySkipped
    ? `- Verify: skipped (${args.verifySkipped})\n`
    : "";
  const registryLine = args.registrySkipped
    ? "- Skipped:    contract is not ERC7984"
    : `- Registered: https://sepolia.etherscan.io/tx/${args.registryTxHash ?? "<pending>"}`;
  const txLine = args.txHash
    ? `- Tx:         https://sepolia.etherscan.io/tx/${args.txHash}\n`
    : "";

  return [
    "## ✅ /zama-skills:deploy complete",
    "",
    "### Deployed",
    `- Contract:   ${args.name}`,
    `- Address:    ${args.address}`,
    `- Etherscan:  https://sepolia.etherscan.io/address/${args.address}`,
    `${txLine}${verifyLine}`,
    "### Confidential Token Registry",
    registryLine,
    "",
    "### ABI export",
    `- ${args.abiPath}`,
    "",
    "### Frontend env reminder",
    "Update `packages/frontend/.env`:",
    "",
    `  VITE_${upper}_ADDRESS=${args.address}`,
    `  VITE_${upper}_NETWORK=sepolia`,
    "",
    "### What was NOT done",
    "- I did NOT push commits or open a PR — review `git status` and commit yourself.",
    "- I did NOT deploy to mainnet — out of scope for v1.",
    "",
    "### Recommended next skill",
    "/zama-frontend — wire the deployed address into a React UI hook.",
    "",
  ].join("\n");
}

export async function runDeploy(
  opts: RunDeployOptions,
): Promise<RunDeployResult> {
  const root = opts.cwd ?? cwd();
  const env = opts.env ?? procEnv;
  const exec = opts.exec ?? defaultExec;
  const wsCwd = workspaceCwd(root);

  // ── Step 0b — Preflight (chain-id + workspace + deprecation guard) ────
  const pre = runPreflight({ cwd: root });
  if (!pre.ok) {
    return {
      ok: false,
      preflightFailures: pre.failures,
      error: pre.failures[0],
    };
  }

  // ── Step 1 — env-validate ─────────────────────────────────────────────
  const envCheck = validateEnv(env);
  if (!envCheck.ok) {
    return {
      ok: false,
      missingEnv: envCheck.missing,
      error: `env-validate failed: missing ${envCheck.missing.join(", ")}`,
    };
  }

  // ── Step 2 — Compile ──────────────────────────────────────────────────
  try {
    exec("pnpm hardhat compile", { cwd: wsCwd });
  } catch (e) {
    return {
      ok: false,
      error: `compile failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // ── Step 3 — Deploy ───────────────────────────────────────────────────
  let deployOut: string;
  try {
    const argList = (opts.args ?? []).map((a) => JSON.stringify(a)).join(" ");
    const cmd = argList
      ? `pnpm hardhat run --network sepolia scripts/deploy/${opts.contract}.ts -- ${argList}`
      : `pnpm hardhat run --network sepolia scripts/deploy/${opts.contract}.ts`;
    deployOut = exec(cmd, { cwd: wsCwd });
  } catch (e) {
    return {
      ok: false,
      error: `deploy failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const addrMatch = deployOut.match(DEPLOY_LINE);
  if (!addrMatch || !addrMatch[1]) {
    return {
      ok: false,
      error:
        "deploy: no 'Deployed at: 0x...' line in script output. Check scripts/deploy/<Name>.ts emits it.",
    };
  }
  const address = addrMatch[1];
  const txHash = deployOut.match(TX_LINE)?.[1];

  // ── Step 4 — Verify (best-effort, single retry on rate limit) ─────────
  let verifySkipped: string | undefined;
  const argList = (opts.args ?? []).map((a) => JSON.stringify(a)).join(" ");
  const verifyCmd = `pnpm hardhat verify --network sepolia ${address}${argList ? " " + argList : ""}`;
  try {
    exec(verifyCmd, { cwd: wsCwd });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/429|rate.?limit|Max calls per sec/i.test(msg)) {
      try {
        exec(verifyCmd, { cwd: wsCwd });
      } catch (e2) {
        verifySkipped = `rate-limited: ${e2 instanceof Error ? e2.message : String(e2)}`;
      }
    } else {
      verifySkipped = msg;
    }
  }

  // ── Step 5 — Confidential Token Registry registration ─────────────────
  let registryTxHash: string | undefined;
  const isErc7984 = detectErc7984(root, opts.contract);
  if (isErc7984) {
    try {
      const addrs = await getSepoliaAddresses({
        cacheDir: join(root, ".cache"),
        ...(opts.fetcher ? { fetcher: opts.fetcher } : {}),
      });
      const registryAddress = addrs.ConfidentialTokenRegistry;
      if (!registryAddress) {
        return {
          ok: false,
          address,
          error: `sepolia-addresses: ConfidentialTokenRegistry missing in fetched registry. Check ${REGISTRY_URL}.`,
        };
      }
      const out = exec(
        `ZAMA_TOKEN_REGISTRY=${registryAddress} ZAMA_TOKEN_ADDRESS=${address} pnpm hardhat run --network sepolia scripts/register-token.ts`,
        { cwd: wsCwd },
      );
      registryTxHash = out.match(REGISTRY_TX_LINE)?.[1];
    } catch (e) {
      return {
        ok: false,
        address,
        error: `registry registration failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  // ── Step 6 — ABI export ───────────────────────────────────────────────
  let abiPath: string;
  try {
    abiPath = exportAbi(opts.contract, address, { cwd: root });
  } catch (e) {
    return {
      ok: false,
      address,
      error: `abi-export failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // ── Step 7 — Closing summary ──────────────────────────────────────────
  const summaryArgs: Parameters<typeof formatSummary>[0] = {
    name: opts.contract,
    address,
    registrySkipped: !isErc7984,
    abiPath,
  };
  if (txHash !== undefined) summaryArgs.txHash = txHash;
  if (registryTxHash !== undefined) summaryArgs.registryTxHash = registryTxHash;
  if (verifySkipped !== undefined) summaryArgs.verifySkipped = verifySkipped;
  const summary = formatSummary(summaryArgs);

  const result: RunDeployResult = {
    ok: true,
    address,
    abiPath,
    summary,
  };
  if (txHash !== undefined) result.txHash = txHash;
  if (registryTxHash !== undefined) result.registryTxHash = registryTxHash;
  return result;
}

// ── CLI shim ──────────────────────────────────────────────────────────────
const isEntry =
  argv[1] !== undefined && fileURLToPath(import.meta.url) === argv[1];

if (isEntry) {
  const args = argv.slice(2);
  const ci = args.indexOf("--contract");
  if (ci < 0 || !args[ci + 1]) {
    stderr.write(
      "Usage: deploy.ts --contract <Name> [--args <a1> <a2> …]\n",
    );
    exit(2);
  }
  const contract = args[ci + 1] as string;
  const ai = args.indexOf("--args");
  const ctorArgs = ai >= 0 ? args.slice(ai + 1) : [];

  // Merge .env into process.env for CLI runs.
  const envPath = join(cwd(), ".env");
  const merged: Record<string, string | undefined> = { ...procEnv };
  if (existsSync(envPath)) {
    const file = parseDotenv(readFileSync(envPath, "utf8"));
    for (const [k, v] of Object.entries(file)) {
      if (merged[k] === undefined || merged[k] === "") merged[k] = v;
    }
  }

  void runDeploy({ contract, args: ctorArgs, env: merged })
    .then((r) => {
      if (!r.ok) {
        stderr.write(`✗ deploy failed: ${r.error ?? "unknown"}\n`);
        if (r.missingEnv) {
          stderr.write("Missing env vars:\n");
          for (const m of r.missingEnv) stderr.write(`  - ${m}\n`);
        }
        if (r.preflightFailures) {
          stderr.write("Preflight failures:\n");
          for (const f of r.preflightFailures) stderr.write(`  - ${f}\n`);
        }
        exit(1);
      }
      stdout.write((r.summary ?? "") + "\n");
      exit(0);
    })
    .catch((e) => {
      stderr.write(`✗ deploy: ${e instanceof Error ? e.message : String(e)}\n`);
      exit(1);
    });
}
