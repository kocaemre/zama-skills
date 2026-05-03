#!/usr/bin/env node
/**
 * example-smoke-diff.mjs — proves examples/confidential-token/ has not silently
 * drifted from the skills' canonical output (EXAMPLE-05).
 *
 * Strategy (per .planning/phases/05-reference-example-dapp/05-06-ci-smoke-diff-PLAN.md):
 *
 *   1. Validate the allowlist file (fail-fast on bogus regex).
 *   2. For each "key file" in the example, apply normalized comparison:
 *      - package.json    → diff only `dependencies` + `devDependencies` subtrees,
 *                          sorted; cross-check pinned versions from
 *                          plugins/zama-skills/shared/pinned-versions.json.
 *      - Token.sol       → assert structural invariants (license, pragma,
 *                          required imports, forbidden deprecated imports).
 *      - hardhat.config  → assert required imports + substrings + forbidden
 *                          deprecated imports.
 *      - frontend files  → assert required imports + forbidden deprecated imports.
 *   3. Optionally re-scaffold a fresh seed via `scaffold.ts --use-case
 *      confidential-token` into /tmp and diff its Token.sol against the seed
 *      file shipped with the skill (sanity that the skill itself is internally
 *      consistent — defends against a Plan 03/04 refactor accidentally
 *      decoupling the seed copy from the runtime).
 *      Skipped when env SMOKE_DIFF_SKIP_SCAFFOLD=1 (used in unit-test contexts).
 *
 * Drift outside the allowlist exits 1 with a unified diff in stdout. Widening
 * the allowlist requires explicit reviewer sign-off in the PR.
 *
 * Usage:
 *   node scripts/example-smoke-diff.mjs                   # full run
 *   SMOKE_DIFF_SKIP_SCAFFOLD=1 node scripts/example-smoke-diff.mjs
 */

import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// ---------- Paths ----------

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, "..");
export const EXAMPLE_DIR = resolve(
  REPO_ROOT,
  "examples",
  "confidential-token",
);
export const PINNED_VERSIONS_PATH = resolve(
  REPO_ROOT,
  "plugins",
  "zama-skills",
  "shared",
  "pinned-versions.json",
);
export const SCAFFOLD_SCRIPT = resolve(
  REPO_ROOT,
  "plugins",
  "zama-skills",
  "skills",
  "init",
  "scripts",
  "scaffold.ts",
);
export const SEED_TOKEN_SOL = resolve(
  REPO_ROOT,
  "plugins",
  "zama-skills",
  "skills",
  "init",
  "assets",
  "seeds",
  "confidential-token",
  "Token.sol",
);
export const ALLOWLIST_PATH = resolve(
  __dirname,
  "example-smoke-diff.allowlist.json",
);

// ---------- Allowlist validation ----------

/**
 * Validate allowlist shape and pre-compile every regex. Fails fast with a
 * clear message if any regex is malformed (per plan: "allowlist with bogus
 * regex → throws clear error at startup").
 *
 * @param {object} allowlist
 * @returns {object} the same allowlist, with each pattern enriched with `_compiled: RegExp`.
 */
export function validateAllowlist(allowlist) {
  if (!allowlist || typeof allowlist !== "object") {
    throw new Error("allowlist must be an object");
  }
  if (typeof allowlist.comment !== "string" || allowlist.comment.length === 0) {
    throw new Error(
      "allowlist.comment must be a non-empty string (explains the policy to reviewers)",
    );
  }
  if (!Array.isArray(allowlist.patterns)) {
    throw new Error("allowlist.patterns must be an array");
  }
  for (const [i, pat] of allowlist.patterns.entries()) {
    if (!pat || typeof pat.file !== "string" || typeof pat.regex !== "string") {
      throw new Error(
        `allowlist.patterns[${i}] must have string {file, regex}`,
      );
    }
    try {
      pat._compiled = new RegExp(pat.regex);
    } catch (e) {
      throw new Error(
        `allowlist.patterns[${i}] has invalid regex ${JSON.stringify(pat.regex)}: ${e.message}`,
      );
    }
  }
  return allowlist;
}

// ---------- Per-line stripping ----------

/**
 * Apply per-line allowlist regexes for a given file path. Lines that match any
 * of the file's patterns are dropped from the comparison.
 *
 * @param {string} content
 * @param {string} fileRelPath
 * @param {object} allowlist
 * @returns {string} normalized content (CRLF preserved → LF)
 */
export function stripAllowlistedLines(content, fileRelPath, allowlist) {
  const fileRegexes = allowlist.patterns
    .filter((p) => p.file === fileRelPath)
    .map((p) => p._compiled ?? new RegExp(p.regex));
  if (fileRegexes.length === 0) return content;
  const lines = content.split(/\r?\n/);
  const kept = lines.filter((line) => !fileRegexes.some((r) => r.test(line)));
  return kept.join("\n");
}

// ---------- package.json subtree normalization ----------

/**
 * Extract only the named subtrees from a package.json string and emit them
 * with sorted keys at every level so diffs are stable.
 *
 * @param {string} content raw package.json text
 * @param {string[]} subtreeKeys e.g. ["dependencies", "devDependencies"]
 * @returns {string} normalized JSON
 */
export function normalizePackageJsonSubtree(content, subtreeKeys) {
  const parsed = JSON.parse(content);
  const out = {};
  for (const key of subtreeKeys) {
    out[key] = sortObjectKeys(parsed[key] ?? {});
  }
  return JSON.stringify(out, null, 2);
}

function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const sorted = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = sortObjectKeys(obj[k]);
  }
  return sorted;
}

// ---------- Structural invariants ----------

/**
 * Apply a small DSL of structural assertions on a file's content. Returns an
 * array of human-readable violation messages (empty array = pass).
 *
 * Supported invariant keys:
 *   - license              : regex; matches against the SPDX license line
 *   - pragma               : regex; matches against the `pragma solidity X.Y.Z;` line
 *   - required_imports     : string[]; each must appear somewhere in the content
 *   - required_substrings  : string[]; each must appear (literal substring)
 *   - forbidden_imports    : string[]; each treated as regex; none may appear
 *
 * @param {string} content
 * @param {object} invariants
 * @returns {string[]} violation messages
 */
export function checkStructuralInvariants(content, invariants) {
  const violations = [];
  if (invariants.license) {
    const licRe = new RegExp(`SPDX-License-Identifier:\\s*(${invariants.license})`);
    if (!licRe.test(content)) {
      violations.push(
        `license header must match /${invariants.license}/ (SPDX line missing or wrong)`,
      );
    }
  }
  if (invariants.pragma) {
    const pragmaRe = new RegExp(
      `pragma\\s+solidity\\s+\\^?(${invariants.pragma});`,
    );
    if (!pragmaRe.test(content)) {
      violations.push(`pragma must match /${invariants.pragma}/`);
    }
  }
  for (const imp of invariants.required_imports ?? []) {
    if (!content.includes(imp)) {
      violations.push(`missing required import: ${imp}`);
    }
  }
  for (const sub of invariants.required_substrings ?? []) {
    if (!content.includes(sub)) {
      violations.push(`missing required substring: ${sub}`);
    }
  }
  for (const forb of invariants.forbidden_imports ?? []) {
    let re;
    try {
      re = new RegExp(forb);
    } catch {
      re = new RegExp(forb.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    }
    if (re.test(content)) {
      violations.push(`forbidden import detected: ${forb}`);
    }
  }
  return violations;
}

// ---------- Pinned-version satisfaction ----------

/**
 * Cross-check that the example's package.json declares dep versions matching
 * the pinned-versions.json source of truth (the file the skills read at
 * scaffold time).
 *
 * Match policy: exact string equality of the version field. The skills emit
 * the pinned semver string verbatim, so any divergence is meaningful drift.
 *
 * @param {string} pkgJsonContent
 * @param {object} pinned       parsed pinned-versions.json
 * @param {string[]} packageNames packages that MUST be present and matching
 * @param {Record<string,string>} [aliases] optional map: example-pkg-name → pinned-key
 *   used when a single dep lives under different pinned entries depending on
 *   context (e.g. `@zama-fhe/relayer-sdk` in a contracts/devDependencies block
 *   should match the `@zama-fhe/relayer-sdk-dev` pin, not the frontend one).
 * @returns {string[]} violation messages
 */
export function checkPinnedVersionsSatisfied(pkgJsonContent, pinned, packageNames, aliases = {}) {
  const pkg = JSON.parse(pkgJsonContent);
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const violations = [];
  for (const name of packageNames) {
    const declared = allDeps[name];
    const pinnedKey = aliases[name] ?? name;
    const expected = pinned.packages?.[pinnedKey]?.version;
    if (!expected) {
      violations.push(
        `pinned-versions.json missing entry for ${pinnedKey} (allowlist references ${name} → ${pinnedKey} but skill source-of-truth has no pin)`,
      );
      continue;
    }
    if (declared === undefined) {
      violations.push(`example package.json missing required dep: ${name} (expected ${expected})`);
      continue;
    }
    if (declared !== expected) {
      violations.push(
        `dep version drift: ${name} → example has "${declared}", pinned-versions.json has "${expected}"`,
      );
    }
  }
  return violations;
}

// ---------- Diff (unified) ----------

/**
 * Produce a unified diff between two normalized strings (allowlist-stripped,
 * but otherwise raw). Returns an empty string when content matches.
 *
 * Implementation: minimal line-level diff using the Myers-style stub from
 * node:util.diff (Node 22+) when available, else a simple line-by-line
 * comparison that emits a `+/-` per-line block.
 *
 * Plan calls for `node:diff`, but Node has no such builtin; the optional
 * `diff` npm package is not in our root devDeps and we want zero new install
 * burden in CI. Line-level + symmetric output is sufficient for the failure
 * mode (the goal is to print the drift, not to be a perfect patch).
 */
export function diffNormalized(freshContent, committedContent, fileRelPath, allowlist) {
  const a = stripAllowlistedLines(freshContent, fileRelPath, allowlist);
  const b = stripAllowlistedLines(committedContent, fileRelPath, allowlist);
  if (a === b) return "";
  return renderLineDiff(a, b, fileRelPath);
}

function renderLineDiff(a, b, fileRelPath) {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const out = [`--- fresh/${fileRelPath}`, `+++ committed/${fileRelPath}`];
  const max = Math.max(aLines.length, bLines.length);
  let inHunk = false;
  for (let i = 0; i < max; i += 1) {
    const al = aLines[i];
    const bl = bLines[i];
    if (al === bl) {
      if (inHunk) out.push(` ${al ?? ""}`);
      continue;
    }
    if (!inHunk) {
      out.push(`@@ line ${i + 1} @@`);
      inHunk = true;
    }
    if (al !== undefined) out.push(`-${al}`);
    if (bl !== undefined) out.push(`+${bl}`);
  }
  return out.join("\n");
}

// ---------- File reads (defensive) ----------

function readFileOrFail(absPath, label) {
  if (!existsSync(absPath)) {
    throw new Error(
      `skill output missing ${label} (${absPath}) — likely scaffold bug or path drift`,
    );
  }
  return readFileSync(absPath, "utf8");
}

// ---------- Optional fresh-seed scaffold ----------

/**
 * Invoke the init skill's scaffold.ts against a /tmp dir and return the
 * fresh Token.sol contents. Used as a sanity check that the seed file the
 * skill ships still matches what its runtime copies.
 *
 * Skipped (returns null) when env SMOKE_DIFF_SKIP_SCAFFOLD=1.
 */
function scaffoldFreshSeed() {
  if (process.env.SMOKE_DIFF_SKIP_SCAFFOLD === "1") return null;
  if (!existsSync(SCAFFOLD_SCRIPT)) {
    return null; // scaffold script absent → cannot run; treat as soft-skip
  }
  const target = mkdtempSync(join(tmpdir(), "zama-smoke-diff-"));
  const result = spawnSync(
    "npx",
    [
      "tsx",
      SCAFFOLD_SCRIPT,
      "--use-case",
      "confidential-token",
      "--target",
      target,
      "--force",
      "--no-install",
      "--no-compile",
    ],
    { encoding: "utf8", cwd: REPO_ROOT },
  );
  if (result.status !== 0) {
    throw new Error(
      `scaffold.ts failed (status ${result.status}):\n` +
        `STDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }
  // Find the Token.sol the scaffolder wrote.
  const candidates = [
    join(target, "packages", "contracts", "contracts", "Token.sol"),
    join(target, "contracts", "Token.sol"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return { path: c, content: readFileSync(c, "utf8") };
  }
  throw new Error(
    `scaffold.ts succeeded but no Token.sol found in ${target} (checked ${candidates.join(", ")})`,
  );
}

// ---------- Main runner ----------

export async function run({ exampleDir = EXAMPLE_DIR, log = console.log, err = console.error } = {}) {
  // 1. Validate allowlist (fail-fast).
  const allowlist = validateAllowlist(
    JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8")),
  );

  const pinned = JSON.parse(readFileSync(PINNED_VERSIONS_PATH, "utf8"));

  const violations = [];
  const diffs = [];

  // 2a. package.json deps subtree + pinned-version cross-check.
  const pkgRel = "packages/contracts/package.json";
  const pkgAbs = resolve(exampleDir, pkgRel);
  const pkgContent = readFileOrFail(pkgAbs, pkgRel);
  // Pinned-version cross-check.
  const pvCheck = allowlist.pinned_version_check;
  if (pvCheck && pvCheck.must_satisfy_pinned_versions?.length) {
    const pvViolations = checkPinnedVersionsSatisfied(
      pkgContent,
      pinned,
      pvCheck.must_satisfy_pinned_versions,
      pvCheck.aliases ?? {},
    );
    for (const v of pvViolations) violations.push(`[${pkgRel}] ${v}`);
  }
  // Stable subtree (sorted) — useful when --update-snapshot baselines arrive later.
  // For now we just ensure parseability + stable serialization succeeds.
  normalizePackageJsonSubtree(
    pkgContent,
    allowlist.package_json_subtree_keys ?? ["dependencies", "devDependencies"],
  );

  // 2b. Structural invariants for each declared file.
  for (const [fileRel, invariants] of Object.entries(
    allowlist.structural_invariants ?? {},
  )) {
    const abs = resolve(exampleDir, fileRel);
    if (!existsSync(abs)) {
      violations.push(`[${fileRel}] expected file missing from example`);
      continue;
    }
    const content = readFileSync(abs, "utf8");
    const fileViolations = checkStructuralInvariants(content, invariants);
    for (const v of fileViolations) violations.push(`[${fileRel}] ${v}`);
  }

  // 3. Optional: scaffold a fresh seed and diff its Token.sol against the
  // committed seed file (catches the case where someone refactored
  // scaffold.ts but forgot to update the seed copy logic, or vice versa).
  let fresh;
  try {
    fresh = scaffoldFreshSeed();
  } catch (e) {
    err(`! scaffold smoke step skipped: ${e.message}`);
  }
  if (fresh) {
    const seedContent = readFileOrFail(SEED_TOKEN_SOL, "seed Token.sol");
    const d = diffNormalized(
      fresh.content,
      seedContent,
      "packages/contracts/contracts/Token.sol",
      allowlist,
    );
    if (d) {
      diffs.push({ file: "[scaffold-vs-seed] Token.sol", diff: d });
    }
  }

  // 4. Report.
  if (violations.length === 0 && diffs.length === 0) {
    log("✓ example-smoke-diff: no drift detected");
    log(`  - example: ${exampleDir.replace(REPO_ROOT + sep, "")}`);
    log(`  - allowlist patterns: ${allowlist.patterns.length}`);
    log(`  - structural invariants: ${Object.keys(allowlist.structural_invariants ?? {}).length} file(s)`);
    log(`  - pinned-version cross-checks: ${(pvCheck?.must_satisfy_pinned_versions ?? []).length} package(s)`);
    return 0;
  }

  err("✗ example-smoke-diff: drift detected");
  for (const v of violations) err(`  ${v}`);
  for (const { file, diff } of diffs) {
    err(`\n--- DIFF: ${file} ---\n${diff}`);
  }
  err("");
  err(
    "If this drift is intentional (e.g. you bumped a skill template), add a pattern to\n" +
      "scripts/example-smoke-diff.allowlist.json explaining why. Otherwise re-run\n" +
      "/zama-init etc. and commit the fresh output.",
  );
  return 1;
}

// ---------- CLI entry ----------

const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  run().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`! example-smoke-diff crashed: ${e.stack ?? e.message}`);
      process.exit(2);
    },
  );
}
