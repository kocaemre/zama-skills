/**
 * manifest.ts — canonical ScaffoldManifest type produced by scaffold.ts and
 * consumed by closing-summary.ts.
 *
 * Owned by Plan 03-04 (this file). Plan 03-05's closing-summary.ts initially
 * carried a local copy because it landed in the same wave; once 03-04 ships,
 * closing-summary.ts can be refactored to import { ScaffoldManifest } from
 * "./lib/manifest.js".
 */

export type UseCase = "confidential-token" | "voting" | "auction" | "custom";

/** Result of one shell command run during scaffold. */
export interface CommandResult {
  cmd: string;
  cwd?: string;
  ok: boolean;
  durationMs: number;
}

/** Single file written to the materialized scaffold tree. */
export interface FileWritten {
  /** Path relative to the scaffold target dir. */
  path: string;
  bytes: number;
}

/** Single deprecation-grep hit. */
export interface GrepHit {
  file: string;
  line: number;
  text: string;
}

export type DeprecationGrepResult =
  | { ok: true }
  | { ok: false; matches: GrepHit[] };

export interface ScaffoldManifest {
  useCase: UseCase;
  /** Absolute target directory the scaffold was written to. */
  targetDir: string;
  filesWritten: FileWritten[];
  /** Map of @pin key → resolved version string. */
  pinsResolved: Record<string, string>;
  commandsRan: CommandResult[];
  deprecationGrep: DeprecationGrepResult;
}

/** Build a manifest with sensible defaults so callers can fill incrementally. */
export function buildManifest(
  initial: Partial<ScaffoldManifest> & { useCase: UseCase; targetDir: string },
): ScaffoldManifest {
  return {
    useCase: initial.useCase,
    targetDir: initial.targetDir,
    filesWritten: initial.filesWritten ?? [],
    pinsResolved: initial.pinsResolved ?? {},
    commandsRan: initial.commandsRan ?? [],
    deprecationGrep: initial.deprecationGrep ?? { ok: true },
  };
}

/** Compact single-line JSON — closing-summary parses this from stdout. */
export function serializeManifest(m: ScaffoldManifest): string {
  return JSON.stringify(m);
}
