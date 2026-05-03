#!/usr/bin/env node
/**
 * snapshot.mjs — generate `.gsd-snapshot.json` for examples/confidential-token.
 *
 * Captures provenance for EXAMPLE-04:
 *   - Skill commit SHAs (init, contract, test, deploy, frontend)
 *   - sha256 of plugins/zama-skills/shared/pinned-versions.json
 *   - Use-case + scaffold inputs + invocation order
 *
 * Idempotent: by default preserves an existing `created_at` so re-runs do not
 * churn the snapshot for CI smoke-diff (Plan 06). Pass `--touch` to refresh
 * the timestamp.
 *
 * Usage:
 *   node scripts/snapshot.mjs            # default — preserve created_at
 *   node scripts/snapshot.mjs --touch    # refresh created_at to now
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const exampleRoot = resolve(__dirname, "..");
const repoRoot = resolve(exampleRoot, "..", "..");

const skillNames = ["init", "contract", "test", "deploy", "frontend"];

function lastCommitSha(skillDir) {
  const out = execSync(
    `git log -1 --format=%H -- ${skillDir}`,
    { cwd: repoRoot, encoding: "utf8" },
  ).trim();
  if (!out) {
    throw new Error(`No commit found for ${skillDir}`);
  }
  return out;
}

function sha256OfFile(absPath) {
  const buf = readFileSync(absPath);
  return createHash("sha256").update(buf).digest("hex");
}

const skill_versions = {};
for (const name of skillNames) {
  const dir = `plugins/zama-skills/skills/${name}/`;
  skill_versions[name] = lastCommitSha(dir);
}

const pinnedVersionsPath = resolve(
  repoRoot,
  "plugins",
  "zama-skills",
  "shared",
  "pinned-versions.json",
);
const pinned_versions_sha = sha256OfFile(pinnedVersionsPath);

const snapshotPath = resolve(exampleRoot, ".gsd-snapshot.json");
const args = process.argv.slice(2);
const forceTouch = args.includes("--touch");

let created_at = new Date().toISOString();
if (existsSync(snapshotPath) && !forceTouch) {
  try {
    const existing = JSON.parse(readFileSync(snapshotPath, "utf8"));
    if (typeof existing.created_at === "string") {
      created_at = existing.created_at;
    }
  } catch {
    /* fall back to now */
  }
}

const snapshot = {
  version: 1,
  created_at,
  use_case: "erc7984-confidential-token",
  skill_versions,
  pinned_versions_sha,
  scaffold_inputs: {
    contract_name: "Token",
    base: "erc7984",
    decryption_path: "user",
    with_wagmi: true,
  },
  skill_invocation_order: [
    "zama-init",
    "zama-contract",
    "zama-test",
    "zama-frontend",
  ],
};

writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
console.log(`✓ wrote ${snapshotPath}`);
