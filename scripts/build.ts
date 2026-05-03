/**
 * `pnpm sync` engine — transcludes shared snippets/prompts into SKILL.md files,
 * regenerates `generic/<skill>.md` rehberler, rewrites pinned versions inside
 * `examples/*\/package.json`, and (optionally) materializes solc-version markers
 * inside `examples/*\/hardhat.config.ts`.
 *
 * Modes:
 *   tsx scripts/build.ts            — write changes to disk
 *   tsx scripts/build.ts --check    — read-only; exit 1 on drift, 0 on clean
 */

import { readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import fse from "fs-extra";
import pc from "picocolors";

import {
  type MarkerKind,
  replaceAllMarkers,
} from "./lib/markers.js";
import {
  loadVersions,
  loadDeprecated,
  getVersion,
  isDeprecated,
} from "./lib/versions.js";
import { generateGenericFromSkill } from "./lib/generic.js";

const PIN_RE = /<!--\s*@pin:([^\s>]+)\s*-->/g;

const DRIFT_MSG = "Drift detected. Run `pnpm sync` and commit the result.";

export interface SyncResult {
  changed: string[];
  errors: string[];
}

interface SyncOpts {
  check: boolean;
  cwd?: string;
}

interface Dirs {
  SHARED_DIR: string;
  SKILLS_DIR: string;
  GENERIC_DIR: string;
  EXAMPLES_DIR: string;
}

function computeDirs(cwd: string): Dirs {
  return {
    SHARED_DIR: resolve(cwd, "plugins/zama-skills/shared"),
    SKILLS_DIR: resolve(cwd, "plugins/zama-skills/skills"),
    GENERIC_DIR: resolve(cwd, "generic"),
    EXAMPLES_DIR: resolve(cwd, "examples"),
  };
}

function readShared(dirs: Dirs, relPath: string): string {
  const full = resolve(dirs.SHARED_DIR, relPath);
  if (!existsSync(full)) {
    throw new Error(`Shared content not found: ${relPath}`);
  }
  return readFileSync(full, "utf8");
}

function makeResolveMarker(
  dirs: Dirs,
  errors: string[],
): (kind: MarkerKind, name: string) => string {
  return function resolveMarker(kind: MarkerKind, name: string): string {
    let body: string;
    if (kind === "snippet") body = readShared(dirs, `snippets/${name}.md`);
    else if (kind === "prompt") body = readShared(dirs, `prompts/${name}.md`);
    else if (kind === "shared") body = readShared(dirs, `${name}.md`);
    else throw new Error(`Unknown marker kind: ${kind as string}`);
    return resolvePinPlaceholders(body, errors);
  };
}

function resolvePinPlaceholders(text: string, errors: string[]): string {
  return text.replace(PIN_RE, (match, pkg: string) => {
    try {
      return getVersion(pkg);
    } catch {
      errors.push(
        `Unknown @pin package: ${pkg} — add it to plugins/zama-skills/shared/pinned-versions.json or fix the typo`,
      );
      // Leave the original marker untouched so the next sync re-detects it
      // (idempotent only after the package is added/typo-fixed).
      return match;
    }
  });
}

function listSkillDirs(dirs: Dirs): string[] {
  if (!existsSync(dirs.SKILLS_DIR)) return [];
  return readdirSync(dirs.SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => existsSync(join(dirs.SKILLS_DIR, name, "SKILL.md")));
}

function listExamplePackageJsons(dirs: Dirs): string[] {
  if (!existsSync(dirs.EXAMPLES_DIR)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dirs.EXAMPLES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const p = join(dirs.EXAMPLES_DIR, entry.name, "package.json");
    if (existsSync(p)) out.push(p);
  }
  return out;
}

function listExampleHardhatConfigs(dirs: Dirs): string[] {
  if (!existsSync(dirs.EXAMPLES_DIR)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dirs.EXAMPLES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const p = join(dirs.EXAMPLES_DIR, entry.name, "hardhat.config.ts");
    if (existsSync(p)) out.push(p);
  }
  return out;
}

async function applyFile(
  filePath: string,
  expected: string,
  opts: SyncOpts,
  result: SyncResult,
): Promise<void> {
  const onDisk = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  if (onDisk === expected) return;
  if (opts.check) {
    result.errors.push(filePath);
  } else {
    await fse.ensureDir(resolve(filePath, ".."));
    writeFileSync(filePath, expected, "utf8");
    result.changed.push(filePath);
  }
}

function syncSkillMd(
  dirs: Dirs,
  skillName: string,
  resolveMarker: (kind: MarkerKind, name: string) => string,
  errors: string[],
): { path: string; expected: string } {
  const path = join(dirs.SKILLS_DIR, skillName, "SKILL.md");
  const original = readFileSync(path, "utf8");
  const withMarkers = replaceAllMarkers(original, resolveMarker);
  const expected = resolvePinPlaceholders(withMarkers, errors);
  return { path, expected };
}

function syncExamplePackageJson(
  filePath: string,
): { expected: string; deprecatedHits: string[]; incompatibleHits: string[] } {
  type Pkg = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    [k: string]: unknown;
  };
  const raw = readFileSync(filePath, "utf8");
  const obj: Pkg = JSON.parse(raw);
  const versions = loadVersions();
  const deprecated = loadDeprecated();
  const deprecatedHits: string[] = [];
  const incompatibleHits: string[] = [];

  const rewriteSection = (section: Record<string, string> | undefined): void => {
    if (!section) return;
    for (const dep of Object.keys(section)) {
      // Hard error: deprecated package present.
      const dep_ = isDeprecated(dep);
      if (dep_.deprecated) {
        deprecatedHits.push(
          `${filePath}: imports deprecated package ${dep}; replace with ${dep_.replaces ?? "(unknown)"}`,
        );
        continue;
      }
      // Soft warn: incompatible (key includes `@^N`)
      for (const incKey of Object.keys(deprecated.incompatible)) {
        const [name] = incKey.split("@");
        if (name === dep) {
          incompatibleHits.push(
            `${filePath}: ${dep} flagged incompatible (${incKey})`,
          );
        }
      }
      // Rewrite if package is in pinned-versions.json
      if (versions.packages[dep]) {
        section[dep] = getVersion(dep);
      }
    }
  };
  rewriteSection(obj.dependencies);
  rewriteSection(obj.devDependencies);

  const expected = JSON.stringify(obj, null, 2) + "\n";
  return { expected, deprecatedHits, incompatibleHits };
}

function syncHardhatConfig(
  filePath: string,
  resolveMarker: (kind: MarkerKind, name: string) => string,
  errors: string[],
): string {
  const original = readFileSync(filePath, "utf8");
  // Only resolves @sync markers; if none present, returns input unchanged.
  let out = replaceAllMarkers(original, resolveMarker);
  out = resolvePinPlaceholders(out, errors);
  return out;
}

export async function runSync(opts: SyncOpts): Promise<SyncResult> {
  const cwd = opts.cwd ?? process.cwd();
  const dirs = computeDirs(cwd);
  const result: SyncResult = { changed: [], errors: [] };
  // Collect @pin resolution failures separately so we can de-dup before merging.
  const pinErrors: string[] = [];
  const resolveMarker = makeResolveMarker(dirs, pinErrors);
  // Eager-load shared registries so resolveMarker / version helpers don't bail half-way.
  loadVersions();
  loadDeprecated();

  // 1. SKILL.md transclusion.
  const skillNames = listSkillDirs(dirs);
  for (const name of skillNames) {
    const { path, expected } = syncSkillMd(dirs, name, resolveMarker, pinErrors);
    await applyFile(path, expected, opts, result);
  }

  // 2. Generic markdown regeneration (one per SKILL.md, in `generic/`).
  if (!opts.check) await fse.ensureDir(dirs.GENERIC_DIR);
  for (const name of skillNames) {
    const { expected: expandedSkill } = syncSkillMd(dirs, name, resolveMarker, pinErrors);
    const generic = generateGenericFromSkill(name, expandedSkill);
    const target = join(dirs.GENERIC_DIR, `${name}.md`);
    await applyFile(target, generic, opts, result);
  }

  // 3. examples/*/package.json — version sync + deprecation hard-errors.
  const fatal: string[] = [];
  for (const pkgPath of listExamplePackageJsons(dirs)) {
    const { expected, deprecatedHits, incompatibleHits } =
      syncExamplePackageJson(pkgPath);
    if (deprecatedHits.length > 0) {
      fatal.push(...deprecatedHits);
      continue; // do not auto-rewrite a file that imports deprecated deps
    }
    for (const w of incompatibleHits) {
      console.warn(pc.yellow(`warn: ${w}`));
    }
    await applyFile(pkgPath, expected, opts, result);
  }

  // 4. examples/*/hardhat.config.ts — optional marker sync (skip silently if no markers).
  for (const cfgPath of listExampleHardhatConfigs(dirs)) {
    const expected = syncHardhatConfig(cfgPath, resolveMarker, pinErrors);
    await applyFile(cfgPath, expected, opts, result);
  }

  if (fatal.length > 0) {
    result.errors.push(...fatal);
  }
  // De-dup @pin errors (same package can be referenced from many docs).
  if (pinErrors.length > 0) {
    result.errors.push(...Array.from(new Set(pinErrors)));
  }

  return result;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const check = argv.includes("--check");
  const res = await runSync({ check });

  if (res.errors.length > 0) {
    console.error(pc.red(`Drift / fatal issues (${res.errors.length}):`));
    for (const e of res.errors) console.error(pc.red(`  - ${basename(e) === e ? e : e}`));
    console.error(pc.yellow(`\n${DRIFT_MSG}`));
    process.exit(1);
  }

  if (check) {
    console.log(
      pc.green(`✓ No drift across ${res.changed.length} sync targets`),
    );
  } else {
    console.log(pc.green(`✓ Synced ${res.changed.length} file(s)`));
    for (const c of res.changed) console.log(pc.dim(`  - ${c}`));
  }
}

// Auto-run when invoked directly (tsx scripts/build.ts)
const invokedDirect = (() => {
  const arg1 = process.argv[1];
  if (!arg1) return false;
  return arg1.endsWith("scripts/build.ts") || arg1.endsWith("build.ts");
})();
if (invokedDirect) {
  main().catch((err) => {
    console.error(pc.red(`build.ts failed: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  });
}
