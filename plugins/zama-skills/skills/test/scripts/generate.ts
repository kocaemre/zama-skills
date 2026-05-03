/**
 * generate.ts — runtime for /zama-test.
 *
 * Reads packages/contracts/contracts/<Name>.sol, picks the first state-write
 * function whose first parameter is `external<Euint*>` (encrypted input handle),
 * substitutes the mock + sepolia templates, writes both files to
 * packages/contracts/test/.
 *
 * Refuses if either output file already exists unless `--force` is passed.
 *
 * Hard-coded output dir + PascalCase guard prevent path traversal (T-04-11).
 *
 * Post-write grep enforces: no BigNumber.from, no fhevmjs, no ethers.utils.*,
 * no ethers.providers.* (T-04-08 — ethers v5 refusal).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { argv, exit, stderr, stdout, cwd as processCwd } from "node:process";
import { fileURLToPath } from "node:url";

import { runTestPreflight } from "./lib/preflight.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, "..", "assets", "templates");

const PASCAL_CASE_RE = /^[A-Z][A-Za-z0-9]*$/;
// Detect external encrypted-input parameter types from @fhevm/solidity.
const EUINT_EXTERN_RE = /\bexternal(E(?:uint(?:8|16|32|64|128|256)|bool|address))\b/;
// Detect a function declaration with at least one `external<Euint*>` parameter.
const STATE_WRITE_FN_RE =
  /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*\bexternalE(?:uint(?:8|16|32|64|128|256)|bool|address)\b[^)]*)\)/;
// Detect a public/external view function returning `euint*` / `ebool` / `eaddress`.
const READ_FN_RE =
  /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s+external\s+view\s+returns\s*\(\s*(e(?:uint(?:8|16|32|64|128|256)|bool|address))/;

const FORBIDDEN_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /BigNumber\.from/, reason: "ethers v5 BigNumber.from — use BigInt literal (v6)" },
  { re: /\bfhevmjs\b/, reason: "fhevmjs deprecated — use @zama-fhe/relayer-sdk" },
  { re: /ethers\.utils\./, reason: "ethers.utils.* removed in v6 — use top-level helpers" },
  { re: /ethers\.providers\./, reason: "ethers.providers.* removed in v6 — use top-level Provider" },
];

export interface GenerateOptions {
  cwd?: string;
  contract: string;
  force?: boolean;
}

export interface GenerateResult {
  written: string[];
  skipped: string[];
  detected: { writeFn: string; readFn: string; euintType: string };
}

interface DetectedTarget {
  writeFn: string;
  readFn: string;
  euintType: string; // e.g. "euint64"
}

function toFhevmType(euintLower: string): string {
  // euint64 → euint64 (FhevmType enum casing matches lowercase in @fhevm/mock-utils).
  return euintLower;
}

function detectTarget(solSource: string): DetectedTarget {
  const writeMatch = solSource.match(STATE_WRITE_FN_RE);
  let writeFn = "TODO_writeFn";
  let euintType = "euint64";
  if (writeMatch && writeMatch[1] && writeMatch[2]) {
    writeFn = writeMatch[1];
    const externMatch = writeMatch[2].match(EUINT_EXTERN_RE);
    if (externMatch && externMatch[1]) {
      // externEuint64 → euint64
      euintType = externMatch[1].toLowerCase();
    }
  }
  const readMatch = solSource.match(READ_FN_RE);
  const readFn = readMatch && readMatch[1] ? readMatch[1] : "TODO_readFn";
  return { writeFn, readFn, euintType: toFhevmType(euintType) };
}

function substitute(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

function assertNoForbiddenPatterns(file: string, body: string): void {
  for (const { re, reason } of FORBIDDEN_PATTERNS) {
    if (re.test(body)) {
      throw new Error(`Generated ${file} contains forbidden pattern (${re}): ${reason}`);
    }
  }
}

export async function generateTests(opts: GenerateOptions): Promise<GenerateResult> {
  const root = opts.cwd ?? processCwd();

  // PascalCase guard — also blocks "..", "/", "."
  if (!PASCAL_CASE_RE.test(opts.contract)) {
    throw new Error(`Invalid contract name "${opts.contract}" — must be PascalCase ([A-Z][A-Za-z0-9]*)`);
  }

  const pre = await runTestPreflight({ cwd: root, contract: opts.contract });
  if (!pre.ok) {
    throw new Error(`preflight failed:\n  - ${pre.failures.join("\n  - ")}`);
  }

  const solPath = join(root, "packages", "contracts", "contracts", `${opts.contract}.sol`);
  const solSource = readFileSync(solPath, "utf8");
  const detected = detectTarget(solSource);

  const testDir = join(root, "packages", "contracts", "test");
  const mockOut = join(testDir, `${opts.contract}.test.ts`);
  const sepoliaOut = join(testDir, `${opts.contract}.sepolia.test.ts`);

  if (!opts.force) {
    if (existsSync(mockOut)) {
      throw new Error(`${mockOut} already exists — pass --force to overwrite`);
    }
    if (existsSync(sepoliaOut)) {
      throw new Error(`${sepoliaOut} already exists — pass --force to overwrite`);
    }
  }

  const mockTpl = readFileSync(join(TEMPLATES_DIR, "mock.test.ts.tpl"), "utf8");
  const sepoliaTpl = readFileSync(join(TEMPLATES_DIR, "sepolia.test.ts.tpl"), "utf8");

  const vars = {
    NAME: opts.contract,
    WRITE_FN: detected.writeFn,
    READ_FN: detected.readFn,
    EUINT_TYPE: detected.euintType,
  };

  const mockBody = substitute(mockTpl, vars);
  const sepoliaBody = substitute(sepoliaTpl, vars);

  // Post-grep — refuse to write any forbidden pattern.
  assertNoForbiddenPatterns(`${opts.contract}.test.ts`, mockBody);
  assertNoForbiddenPatterns(`${opts.contract}.sepolia.test.ts`, sepoliaBody);

  writeFileSync(mockOut, mockBody);
  writeFileSync(sepoliaOut, sepoliaBody);

  return { written: [mockOut, sepoliaOut], skipped: [], detected };
}

// CLI shim
const isEntry = argv[1] !== undefined && fileURLToPath(import.meta.url) === argv[1];
if (isEntry) {
  const contractIdx = argv.indexOf("--contract");
  const contract = contractIdx >= 0 ? argv[contractIdx + 1] : undefined;
  const force = argv.includes("--force");
  if (!contract) {
    stderr.write("usage: tsx generate.ts --contract <Name> [--force]\n");
    exit(2);
  }
  void generateTests({ contract, force })
    .then((r) => {
      stdout.write(JSON.stringify(r, null, 2) + "\n");
      stderr.write(`✓ /zama-test generated ${r.written.length} files\n`);
      for (const f of r.written) stderr.write(`  - ${f}\n`);
      exit(0);
    })
    .catch((err: Error) => {
      stderr.write(`✗ /zama-test generate failed: ${err.message}\n`);
      exit(1);
    });
}
