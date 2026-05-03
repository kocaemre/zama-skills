import { z } from "zod";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PackageEntrySchema = z.object({
  version: z.string(),
  exact: z.boolean().optional(),
  aliasOf: z.string().optional(),
  notes: z.string().optional(),
});

export const VersionsSchema = z.object({
  $schema: z.string().optional(),
  packages: z.record(PackageEntrySchema),
  compiler: z.object({ solc: z.string() }),
  node: z.string(),
  typescript: z.string(),
});

export const DeprecatedSchema = z.object({
  $schema: z.string().optional(),
  deprecated: z.record(
    z.object({
      deprecated: z.literal(true),
      replaces: z.string(),
      deprecatedAt: z.string().optional(),
      notes: z.string().optional(),
    }),
  ),
  incompatible: z.record(
    z.object({
      incompatible: z.literal(true),
      reason: z.string(),
      useInstead: z.string(),
    }),
  ),
});

export type Versions = z.infer<typeof VersionsSchema>;
export type Deprecated = z.infer<typeof DeprecatedSchema>;

const SHARED_DIR = resolve(process.cwd(), "plugins/zama-skills/shared");

let _versions: Versions | null = null;
let _deprecated: Deprecated | null = null;

export function loadVersions(path?: string): Versions {
  const target = path ?? resolve(SHARED_DIR, "pinned-versions.json");
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(target, "utf8"));
  } catch (err) {
    throw new Error(
      `Invalid JSON in ${target}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const parsed = VersionsSchema.parse(raw);
  // Only cache when called with the default path. Caching a custom-path load
  // would poison subsequent getVersion(...) calls in production code.
  if (path === undefined) _versions = parsed;
  return parsed;
}

export function loadDeprecated(path?: string): Deprecated {
  const target = path ?? resolve(SHARED_DIR, "deprecated-imports.json");
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(target, "utf8"));
  } catch (err) {
    throw new Error(
      `Invalid JSON in ${target}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const parsed = DeprecatedSchema.parse(raw);
  if (path === undefined) _deprecated = parsed;
  return parsed;
}

export function getVersion(pkg: string): string {
  const v = _versions ?? loadVersions();
  const entry = v.packages[pkg];
  if (!entry) {
    throw new Error(`Package not found in pinned-versions.json: ${pkg}`);
  }
  return entry.version;
}

export function isDeprecated(
  pkg: string,
): { deprecated: boolean; replaces?: string; reason?: string } {
  const d = _deprecated ?? loadDeprecated();
  const entry = d.deprecated[pkg];
  if (entry) {
    return { deprecated: true, replaces: entry.replaces, reason: entry.notes };
  }
  return { deprecated: false };
}

export function getCompilerVersion(): string {
  const v = _versions ?? loadVersions();
  return v.compiler.solc;
}

export function listAllPackages(): string[] {
  const v = _versions ?? loadVersions();
  return Object.keys(v.packages);
}

/** Reset module state — for tests only. */
export function _resetCache(): void {
  _versions = null;
  _deprecated = null;
}
