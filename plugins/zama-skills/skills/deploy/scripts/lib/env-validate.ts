/**
 * env-validate.ts — Strict .env validation for /zama-deploy.
 *
 * Required vars (DEPLOY-04): SEPOLIA_RPC_URL, ETHERSCAN_API_KEY.
 * Either-of group: at least one of MNEMONIC | PRIVATE_KEY.
 *
 * Returns a `{ ok, missing }` object. CLI mode loads `.env` from cwd via
 * a tiny dotenv parser (no runtime dependency) and exits non-zero with a
 * named-missing list when invalid.
 *
 * The skill body relies on the printed list to surface exactly which
 * vars the user must add — never a generic "env failed" message.
 */

import { existsSync, readFileSync } from "node:fs";
import { argv, cwd, exit, env as procEnv, stderr, stdout } from "node:process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_ENV = ["SEPOLIA_RPC_URL", "ETHERSCAN_API_KEY"] as const;
export const EITHER_ENV: ReadonlyArray<readonly [string, string]> = [
  ["MNEMONIC", "PRIVATE_KEY"],
];

export interface ValidateResult {
  ok: boolean;
  /** Missing var names. Either-of groups appear as "A|B". */
  missing: string[];
}

function present(env: Record<string, string | undefined>, key: string): boolean {
  const v = env[key];
  return typeof v === "string" && v.length > 0;
}

export function validateEnv(
  env: Record<string, string | undefined>,
): ValidateResult {
  const missing: string[] = [];
  for (const k of REQUIRED_ENV) {
    if (!present(env, k)) missing.push(k);
  }
  for (const group of EITHER_ENV) {
    if (!group.some((k) => present(env, k))) {
      missing.push(group.join("|"));
    }
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Minimal .env parser (no dotenv dep). Handles `KEY=value`, ignores
 * blank lines and `#` comments, strips surrounding quotes.
 */
export function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function loadEnvFromCwd(): Record<string, string | undefined> {
  const envPath = join(cwd(), ".env");
  const merged: Record<string, string | undefined> = { ...procEnv };
  if (existsSync(envPath)) {
    const fileEnv = parseDotenv(readFileSync(envPath, "utf8"));
    for (const [k, v] of Object.entries(fileEnv)) {
      if (merged[k] === undefined || merged[k] === "") merged[k] = v;
    }
  }
  return merged;
}

// CLI shim — runs only when executed directly.
const isEntry =
  argv[1] !== undefined && fileURLToPath(import.meta.url) === argv[1];
if (isEntry) {
  const env = loadEnvFromCwd();
  const r = validateEnv(env);
  stdout.write(JSON.stringify(r, null, 2) + "\n");
  if (r.ok) {
    stderr.write("✓ env-validate passed\n");
    exit(0);
  }
  stderr.write("✗ env-validate failed. Missing required env vars:\n");
  for (const m of r.missing) {
    const note = m.includes("|") ? "  (need at least one)" : "";
    stderr.write(`  - ${m}${note}\n`);
  }
  stderr.write(
    "\nAdd the missing vars to .env then re-run /zama-skills:deploy.\n",
  );
  exit(1);
}
