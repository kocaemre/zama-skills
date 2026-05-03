/**
 * scaffold.ts — runtime orchestrator for `/zama-init`.
 *
 * Invoked by SKILL.md via `${CLAUDE_SKILL_DIR}/scripts/scaffold.ts` with `tsx`.
 * Materializes templates (Plan 03-02), copies the use-case seed contract
 * (Plan 03-03), runs `pnpm install` + `pnpm hardhat compile`, then performs
 * a belt-and-suspenders deprecation grep over the output. Emits a
 * `ScaffoldManifest` JSON to stdout for `closing-summary.ts` to consume.
 *
 * Design notes:
 *   - We do NOT clone fhevm-react-template at runtime. Per
 *     `.planning/phases/03-zama-init-end-to-end/ORCHESTRATION.md`
 *     "React-Template Drift Risk", post-processing a moving fork is fragile;
 *     hand-authored templates pinned via shared/pinned-versions.json give a
 *     deterministic, compile-green result. Future maintainers: do not bolt a
 *     git clone step on top of this — extend the templates instead.
 *   - Templates ship with `<!-- @pin:<pkg> -->` placeholders resolved at
 *     scaffold time against `plugins/zama-skills/shared/pinned-versions.json`.
 *   - Runtime substitutions `{{USE_CASE}}` (kebab) and `{{USE_CASE_TITLE}}`
 *     (Title Case) are applied after pin resolution.
 *   - All progress logs go to stderr; stdout carries only the manifest JSON
 *     so callers can pipe `tsx scaffold.ts ... | tsx closing-summary.ts`.
 *
 * CLI:
 *   tsx scaffold.ts --use-case <token|confidential-token|voting|auction|custom> \
 *                   --target <dir> [--force] [--no-install] [--no-compile]
 *   tsx scaffold.ts --post-grep <dir>
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  type Dirent,
} from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, exit, stderr, stdout } from "node:process";
import fse from "fs-extra";
import pc from "picocolors";

import { resolvePins } from "./lib/pin-resolver.js";
import {
  buildManifest,
  serializeManifest,
  type CommandResult,
  type FileWritten,
  type GrepHit,
  type ScaffoldManifest,
  type UseCase,
} from "./lib/manifest.js";

// ---------- Use-case helpers ----------

const KNOWN_USE_CASES: readonly UseCase[] = [
  "confidential-token",
  "voting",
  "auction",
  "custom",
] as const;

function normalizeUseCase(input: string): UseCase | null {
  const lower = input.toLowerCase().trim();
  if (lower === "token") return "confidential-token";
  if ((KNOWN_USE_CASES as readonly string[]).includes(lower)) {
    return lower as UseCase;
  }
  return null;
}

function titleCaseUseCase(uc: UseCase): string {
  // "confidential-token" → "Confidential Token"
  return uc
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// ---------- Plugin-root discovery ----------

/**
 * Walk up from a starting directory looking for the marker that identifies
 * an installed zama-skills plugin tree containing pinned-versions.json.
 *
 * Returns the directory containing `shared/pinned-versions.json` (the
 * `plugins/zama-skills/` root) or null if not found.
 */
function findPluginRoot(start: string): string | null {
  let dir = resolve(start);
  // Hard upper bound to avoid infinite loops on unusual mounts.
  for (let i = 0; i < 12; i += 1) {
    const candidate = resolve(dir, "shared", "pinned-versions.json");
    if (existsSync(candidate)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function locatePluginRoot(): string {
  // 1. Walk up from the script's own location (bundled install path).
  const here = dirname(fileURLToPath(import.meta.url));
  const fromHere = findPluginRoot(here);
  if (fromHere) return fromHere;
  // 2. Walk up from CWD (dev / repo invocation).
  const fromCwd = findPluginRoot(process.cwd());
  if (fromCwd) return fromCwd;
  throw new Error(
    `Could not locate pinned-versions.json. Searched up from ${here} and ${process.cwd()}. This script must run from within an installed zama-skills plugin tree.`,
  );
}

// ---------- Template walk ----------

interface TemplateFile {
  /** Absolute source .tpl path. */
  src: string;
  /** Path relative to templates/ root, with .tpl stripped. */
  destRel: string;
}

function walkTemplates(templatesRoot: string): TemplateFile[] {
  const out: TemplateFile[] = [];
  function recurse(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        recurse(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".tpl")) continue;
      const rel = relative(templatesRoot, full);
      // Strip the trailing `.tpl` only — preserves `.env.example`, `.gitignore`.
      const stripped = rel.replace(/\.tpl$/, "");
      // Special-case the root-* templates: `root-package.json` → `package.json`,
      // `root-readme.md` → `README.md`. They live at the templates/ root and
      // were renamed only to disambiguate from packages/<name>/package.json.
      let destRel = stripped;
      if (!stripped.includes(sep)) {
        if (stripped === "root-package.json") destRel = "package.json";
        else if (stripped === "root-readme.md") destRel = "README.md";
      }
      out.push({ src: full, destRel });
    }
  }
  recurse(templatesRoot);
  return out;
}

// ---------- Use-case → seed mapping ----------

interface SeedSpec {
  /** Path to copy a single .sol file from (under seeds/<useCase>/). */
  contractFileName: string;
  /** Optional extra script to copy (only for confidential-token). */
  extraScript?: { srcRel: string; destRel: string };
}

function seedSpecFor(useCase: UseCase): SeedSpec {
  switch (useCase) {
    case "confidential-token":
      return {
        contractFileName: "Token.sol",
        extraScript: {
          srcRel: "scripts/register-token.ts",
          destRel: "packages/contracts/scripts/register-token.ts",
        },
      };
    case "voting":
      return { contractFileName: "Poll.sol" };
    case "auction":
      return { contractFileName: "SealedBidAuction.sol" };
    case "custom":
      return { contractFileName: "Skeleton.sol" };
  }
}

// ---------- Deprecation grep ----------

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "cache",
  "artifacts",
  "typechain-types",
  "dist",
  ".pnpm-store",
]);

const SCAN_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".sol",
  ".json",
]);

/**
 * Detect whether a line is a comment — comment lines are allowlisted because
 * Skeleton.sol legitimately mentions deprecated package names inside its
 * deprecation-guard banner. We deliberately scan ONLY package.json (full file)
 * and import-statement-style hits in source files.
 */
function isCommentLine(line: string): boolean {
  const trimmed = line.replace(/^\s+/, "");
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("#")
  );
}

interface ScanFinding {
  hit: GrepHit;
}

/**
 * Scan a single file. Returns hits matching:
 *   - In package.json: any line containing `"fhevmjs"` or `"fhevm":` (the
 *     bare root-pkg dependency entry).
 *   - In .ts/.tsx/.js/.jsx/.sol: import-statement style references to
 *     `fhevmjs` (any path under it). The legacy root `fhevm` package would
 *     surface as a JSON dep, not a .sol/ts import we'd auto-write — but we
 *     still flag any non-comment occurrence of `from "fhevm"` or
 *     `import "fhevm/`.
 *
 * Comment lines are skipped to allow Skeleton.sol's deprecation banner.
 */
function scanFile(
  absPath: string,
  relPath: string,
): ScanFinding[] {
  const findings: ScanFinding[] = [];
  let text: string;
  try {
    text = readFileSync(absPath, "utf8");
  } catch {
    return findings;
  }
  const isPkgJson = relPath.endsWith("package.json");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    if (isCommentLine(raw)) continue;
    if (isPkgJson) {
      // JSON dep entries — match the literal key forms that would appear in
      // a dependency map.
      if (/"fhevmjs"\s*:/.test(raw) || /"fhevm"\s*:/.test(raw)) {
        findings.push({
          hit: { file: relPath, line: i + 1, text: raw.trim() },
        });
      }
      continue;
    }
    // Source files — only flag import-statement-style references.
    const importedFhevmjs =
      /\b(from|require\()\s*["']fhevmjs(\/|["'])/.test(raw) ||
      /\bimport\s+["']fhevmjs(\/|["'])/.test(raw);
    const importedRootFhevm =
      /\b(from|require\()\s*["']fhevm(\/|["'])/.test(raw) ||
      /\bimport\s+["']fhevm(\/|["'])/.test(raw);
    if (importedFhevmjs || importedRootFhevm) {
      findings.push({
        hit: { file: relPath, line: i + 1, text: raw.trim() },
      });
    }
  }
  return findings;
}

export function postGrep(targetDir: string): {
  ok: boolean;
  matches: GrepHit[];
} {
  const root = resolve(targetDir);
  const matches: GrepHit[] = [];
  function recurse(dir: string): void {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true }) as Dirent[];
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        recurse(join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const full = join(dir, entry.name);
      const rel = relative(root, full);
      // Walk extensions of interest (or any package.json).
      const lastDot = entry.name.lastIndexOf(".");
      const ext = lastDot >= 0 ? entry.name.slice(lastDot) : "";
      if (!SCAN_EXTS.has(ext)) continue;
      const found = scanFile(full, rel);
      for (const f of found) matches.push(f.hit);
    }
  }
  recurse(root);
  return { ok: matches.length === 0, matches };
}

// ---------- Command runner ----------

interface RunCmdOpts {
  cmd: string;
  args: string[];
  cwd: string;
  label: string;
}

async function runCmd(opts: RunCmdOpts): Promise<CommandResult> {
  const fullCmd = `${opts.cmd} ${opts.args.join(" ")}`;
  stderr.write(pc.cyan(`▶ ${fullCmd}  (cwd: ${opts.cwd})\n`));
  const start = Date.now();
  return new Promise((resolveFn) => {
    const child = spawn(opts.cmd, opts.args, {
      cwd: opts.cwd,
      stdio: ["ignore", "inherit", "inherit"],
      shell: false,
    });
    child.on("error", (err) => {
      stderr.write(pc.red(`✗ ${opts.label} failed to spawn: ${err.message}\n`));
      resolveFn({
        cmd: fullCmd,
        cwd: opts.cwd,
        ok: false,
        durationMs: Date.now() - start,
      });
    });
    child.on("close", (code) => {
      const ok = code === 0;
      const durationMs = Date.now() - start;
      if (ok) {
        stderr.write(pc.green(`✓ ${opts.label} (${durationMs}ms)\n`));
      } else {
        stderr.write(pc.red(`✗ ${opts.label} exited with code ${code}\n`));
      }
      resolveFn({ cmd: fullCmd, cwd: opts.cwd, ok, durationMs });
    });
  });
}

// ---------- Args ----------

interface ParsedArgs {
  mode: "scaffold" | "post-grep";
  useCase?: UseCase;
  target?: string;
  force: boolean;
  install: boolean;
  compile: boolean;
  postGrepDir?: string;
}

function parseArgs(args: string[]): ParsedArgs {
  let mode: "scaffold" | "post-grep" = "scaffold";
  let useCaseRaw: string | undefined;
  let target: string | undefined;
  let force = false;
  let install = true;
  let compile = true;
  let postGrepDir: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    switch (a) {
      case "--use-case":
        useCaseRaw = args[i + 1];
        i += 1;
        break;
      case "--target":
        target = args[i + 1];
        i += 1;
        break;
      case "--force":
        force = true;
        break;
      case "--no-install":
        install = false;
        break;
      case "--no-compile":
        compile = false;
        break;
      case "--post-grep":
        mode = "post-grep";
        postGrepDir = args[i + 1];
        i += 1;
        break;
      default:
        break;
    }
  }
  let useCase: UseCase | undefined;
  if (useCaseRaw !== undefined) {
    const normalized = normalizeUseCase(useCaseRaw);
    if (normalized === null) {
      throw new Error(
        `Unknown --use-case "${useCaseRaw}". Expected one of: token, confidential-token, voting, auction, custom.`,
      );
    }
    useCase = normalized;
  }
  return { mode, useCase, target, force, install, compile, postGrepDir };
}

// ---------- Scaffold core ----------

export interface ScaffoldOptions {
  useCase: UseCase;
  targetDir: string;
  force?: boolean;
  install?: boolean;
  compile?: boolean;
  pluginRoot?: string;
}

async function dirIsNonEmpty(dir: string): Promise<boolean> {
  if (!existsSync(dir)) return false;
  const s = statSync(dir);
  if (!s.isDirectory()) return true; // a file at that path counts as occupied
  const entries = readdirSync(dir);
  return entries.length > 0;
}

export async function scaffold(
  opts: ScaffoldOptions,
): Promise<ScaffoldManifest> {
  const pluginRoot = opts.pluginRoot ?? locatePluginRoot();
  const targetAbs = resolve(opts.targetDir);

  if (!opts.force && (await dirIsNonEmpty(targetAbs))) {
    throw new Error(
      `Target directory is not empty: ${targetAbs}. Pass --force to overwrite (will merge files), or choose another path.`,
    );
  }

  const versionsPath = resolve(pluginRoot, "shared", "pinned-versions.json");
  // Read pinned-versions.json directly. We deliberately do NOT depend on
  // the repo-level `scripts/lib/versions.ts` here — that module lives outside
  // the plugin distribution tree and would not exist when the plugin is
  // installed under `~/.claude/skills/`. The schema we consume is the same.
  const versionsRaw = JSON.parse(readFileSync(versionsPath, "utf8")) as {
    packages: Record<string, { version: string; aliasOf?: string }>;
    compiler: { solc: string };
  };
  const getVersion = (pkg: string): string => {
    const entry = versionsRaw.packages[pkg];
    if (!entry) {
      throw new Error(`Package not found in pinned-versions.json: ${pkg}`);
    }
    return entry.version;
  };
  const getCompilerVersion = (): string => versionsRaw.compiler.solc;

  const templatesRoot = resolve(
    pluginRoot,
    "skills",
    "init",
    "assets",
    "templates",
  );
  const seedsRoot = resolve(pluginRoot, "skills", "init", "assets", "seeds");

  const useCaseSlug = opts.useCase;
  const useCaseTitle = titleCaseUseCase(opts.useCase);

  const filesWritten: FileWritten[] = [];
  const pinsResolved: Record<string, string> = {};
  const commandsRan: CommandResult[] = [];

  // 1. Materialize templates.
  const templates = walkTemplates(templatesRoot);
  for (const t of templates) {
    const raw = readFileSync(t.src, "utf8");
    const { resolved, pins } = resolvePins(raw, {
      getVersion,
      getCompilerVersion,
    });
    for (const [k, v] of Object.entries(pins)) pinsResolved[k] = v;
    const substituted = resolved
      .split("{{USE_CASE_TITLE}}")
      .join(useCaseTitle)
      .split("{{USE_CASE}}")
      .join(useCaseSlug);
    const dest = resolve(targetAbs, t.destRel);
    await fse.outputFile(dest, substituted, "utf8");
    filesWritten.push({
      path: t.destRel,
      bytes: Buffer.byteLength(substituted, "utf8"),
    });
  }

  // 2. Copy seed contract(s).
  const seed = seedSpecFor(opts.useCase);
  const seedContractSrc = resolve(
    seedsRoot,
    opts.useCase,
    seed.contractFileName,
  );
  const seedContractDest = resolve(
    targetAbs,
    "packages",
    "contracts",
    "contracts",
    seed.contractFileName,
  );
  await fse.copy(seedContractSrc, seedContractDest, { overwrite: true });
  filesWritten.push({
    path: relative(targetAbs, seedContractDest),
    bytes: statSync(seedContractDest).size,
  });
  if (seed.extraScript) {
    const extraSrc = resolve(seedsRoot, opts.useCase, seed.extraScript.srcRel);
    const extraDest = resolve(targetAbs, seed.extraScript.destRel);
    await fse.copy(extraSrc, extraDest, { overwrite: true });
    filesWritten.push({
      path: seed.extraScript.destRel,
      bytes: statSync(extraDest).size,
    });
  }

  // 3. pnpm install (target root).
  const manifest = buildManifest({
    useCase: opts.useCase,
    targetDir: targetAbs,
    filesWritten,
    pinsResolved,
    commandsRan,
  });

  if (opts.install !== false) {
    const r = await runCmd({
      cmd: "pnpm",
      args: ["install"],
      cwd: targetAbs,
      label: "pnpm install",
    });
    commandsRan.push(r);
    if (!r.ok) {
      manifest.commandsRan = commandsRan;
      stderr.write(pc.red("Aborting after pnpm install failure.\n"));
      stderr.write(serializeManifest(manifest) + "\n");
      throw new Error("pnpm install failed");
    }
  }

  // 4. pnpm hardhat compile (packages/contracts).
  if (opts.compile !== false) {
    const contractsDir = resolve(targetAbs, "packages", "contracts");
    const r = await runCmd({
      cmd: "pnpm",
      args: ["hardhat", "compile"],
      cwd: contractsDir,
      label: "pnpm hardhat compile",
    });
    commandsRan.push(r);
    if (!r.ok) {
      manifest.commandsRan = commandsRan;
      stderr.write(pc.red("Aborting after hardhat compile failure.\n"));
      stderr.write(serializeManifest(manifest) + "\n");
      throw new Error("pnpm hardhat compile failed");
    }
  }

  // 5. Belt-and-suspenders deprecation grep.
  const grep = postGrep(targetAbs);
  manifest.commandsRan = commandsRan;
  manifest.deprecationGrep = grep.ok
    ? { ok: true }
    : { ok: false, matches: grep.matches };
  if (!grep.ok) {
    stderr.write(
      pc.red(
        `✗ deprecation grep matched ${grep.matches.length} entr${
          grep.matches.length === 1 ? "y" : "ies"
        } — refusing to declare scaffold healthy.\n`,
      ),
    );
    for (const m of grep.matches) {
      stderr.write(pc.red(`  ${m.file}:${m.line}: ${m.text}\n`));
    }
    throw new Error("deprecation grep failed");
  }

  return manifest;
}

// ---------- main / CLI ----------

export async function main(rawArgs: string[]): Promise<number> {
  let args: ParsedArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    stderr.write(
      pc.red(`✗ ${err instanceof Error ? err.message : String(err)}\n`),
    );
    return 1;
  }

  if (args.mode === "post-grep") {
    if (!args.postGrepDir) {
      stderr.write(pc.red("✗ --post-grep requires a <dir> argument.\n"));
      return 1;
    }
    const result = postGrep(args.postGrepDir);
    stdout.write(JSON.stringify(result) + "\n");
    if (result.ok) {
      stderr.write(pc.green("✓ post-grep clean\n"));
      return 0;
    }
    stderr.write(
      pc.red(`✗ post-grep matched ${result.matches.length} entries\n`),
    );
    return 1;
  }

  if (!args.useCase) {
    stderr.write(pc.red("✗ --use-case is required.\n"));
    return 1;
  }
  if (!args.target) {
    stderr.write(pc.red("✗ --target is required.\n"));
    return 1;
  }

  try {
    const manifest = await scaffold({
      useCase: args.useCase,
      targetDir: args.target,
      force: args.force,
      install: args.install,
      compile: args.compile,
    });
    stdout.write(serializeManifest(manifest) + "\n");
    stderr.write(pc.green("✓ scaffold complete\n"));
    return 0;
  } catch (err) {
    stderr.write(
      pc.red(`✗ ${err instanceof Error ? err.message : String(err)}\n`),
    );
    return 1;
  }
}

const isEntry =
  argv[1] !== undefined && fileURLToPath(import.meta.url) === argv[1];

if (isEntry) {
  void main(argv.slice(2)).then((code) => exit(code));
}
