/**
 * closing-summary.ts — Render the markdown closing block printed by /zama-init
 * after a successful scaffold + install + compile.
 *
 * Reads three shared markdown sources at runtime:
 *   - shared/prompts/closing-summary.md     (template, fenced under "## Template")
 *   - shared/snippets/versions-table.md     (versions table substrate)
 *   - shared/snippets/sepolia-faucet.md     (faucet URLs + setup)
 *
 * Substitutes 7 placeholders, then appends three required tail lines verbatim
 * (MetaMask deep-link, context7 reassurance, "Commands that already passed").
 *
 * Public API:
 *   - renderClosingSummary(manifest, ctx) => string  (pure)
 *   - CLI shim: --manifest <path> | stdin, --use-case <name>, --shared-dir <path>
 *
 * NOTE: The canonical `ScaffoldManifest` type lives in `./lib/manifest.ts`
 * (Plan 03-04). We narrow the manifest's strongly-typed shape into the
 * loose form consumed by this renderer to keep backward compatibility with
 * any caller that still emits the older `filesWritten: string[]` form.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, exit, stdin, stdout } from "node:process";

import type {
  ScaffoldManifest as CanonicalScaffoldManifest,
  CommandResult as CanonicalCommandResult,
} from "./lib/manifest.js";

/** Result of one shell command run during scaffold (renderer-local shape). */
export interface CommandResult {
  cmd: string;
  ok: boolean;
  durationMs?: number;
}

/**
 * Manifest shape this renderer consumes. We accept either the canonical
 * 03-04 `ScaffoldManifest` (filesWritten as `{path,bytes}[]`) or the
 * legacy `filesWritten: string[]` form — `coerceManifest` normalizes.
 */
export interface ScaffoldManifest {
  filesWritten: string[];
  commandsRan: CommandResult[];
  scaffoldDir?: string;
}

/** Normalize a canonical or legacy manifest into the renderer-local shape. */
export function coerceManifest(
  raw: CanonicalScaffoldManifest | ScaffoldManifest,
): ScaffoldManifest {
  const files: string[] = Array.isArray(raw.filesWritten)
    ? raw.filesWritten.map((f) =>
        typeof f === "string" ? f : (f as { path: string }).path,
      )
    : [];
  const cmds: CommandResult[] = (raw.commandsRan ?? []).map(
    (c: CommandResult | CanonicalCommandResult) => ({
      cmd: c.cmd,
      ok: c.ok,
      durationMs: c.durationMs,
    }),
  );
  const scaffoldDir =
    "scaffoldDir" in raw && typeof raw.scaffoldDir === "string"
      ? raw.scaffoldDir
      : "targetDir" in raw && typeof raw.targetDir === "string"
        ? raw.targetDir
        : undefined;
  return { filesWritten: files, commandsRan: cmds, scaffoldDir };
}

export interface ClosingSummaryContext {
  /** One of "confidential-token" | "voting" | "auction" | "custom". */
  useCase: string;
  /** Path to plugins/zama-skills/shared/. */
  sharedDir: string;
  /** Override the skill name printed in the heading. Default: "/zama-init". */
  skillName?: string;
  /** Cap for INSTALLED_FILES rendering (default 30). */
  filesCap?: number;
}

const META_MASK_LINE =
  "Add Sepolia to MetaMask: https://chainid.network/?search=sepolia";
const CONTEXT7_LINE =
  "> context7 was queried at scaffold time — every dependency pin is verified live, no hallucinated APIs.";

/** Extract the markdown block fenced under the "## Template" section. */
function extractTemplate(closingSummaryMd: string): string {
  const lines = closingSummaryMd.split(/\r?\n/);
  let inTemplateSection = false;
  let inFence = false;
  const collected: string[] = [];
  for (const line of lines) {
    if (!inTemplateSection) {
      if (/^##\s+Template\s*$/.test(line)) inTemplateSection = true;
      continue;
    }
    if (!inFence) {
      if (/^```/.test(line)) {
        inFence = true;
        continue;
      }
      // No fence opened yet but a new heading appeared — abort.
      if (/^##\s/.test(line)) break;
      continue;
    }
    // inside fence
    if (/^```/.test(line)) break;
    collected.push(line);
  }
  if (collected.length === 0) {
    throw new Error(
      "closing-summary.md: could not locate fenced template under '## Template'.",
    );
  }
  return collected.join("\n");
}

/** Group manifest.filesWritten by top-level directory; render nested bullets. */
function renderInstalledFiles(files: string[], cap: number): string {
  if (files.length === 0) return "_(no files written)_";

  const groups = new Map<string, string[]>();
  for (const raw of files) {
    const f = raw.replace(/^\.\//, "");
    const slash = f.indexOf("/");
    let group: string;
    let rest: string;
    if (slash === -1) {
      group = ".";
      rest = f;
    } else {
      // Group two levels deep when path begins with "packages/<name>/...".
      if (f.startsWith("packages/")) {
        const second = f.indexOf("/", "packages/".length);
        if (second !== -1) {
          group = f.slice(0, second) + "/";
          rest = f.slice(second + 1);
        } else {
          group = "packages/";
          rest = f.slice("packages/".length);
        }
      } else {
        group = f.slice(0, slash + 1);
        rest = f.slice(slash + 1);
      }
    }
    const bucket = groups.get(group) ?? [];
    bucket.push(rest);
    groups.set(group, bucket);
  }

  const orderedGroups = [...groups.keys()].sort((a, b) => {
    if (a === ".") return 1;
    if (b === ".") return -1;
    return a.localeCompare(b);
  });

  const out: string[] = [];
  let rendered = 0;
  let omitted = 0;
  for (const g of orderedGroups) {
    out.push(`- **${g === "." ? "(root)" : g}**`);
    const items = groups.get(g) ?? [];
    for (const item of items) {
      if (rendered < cap) {
        out.push(`  - ${item}`);
        rendered += 1;
      } else {
        omitted += 1;
      }
    }
  }
  if (omitted > 0) {
    out.push(`- _(+${omitted} more)_`);
  }
  return out.join("\n");
}

const NOT_DONE_LIST = [
  "- I did NOT deploy — run `/zama-deploy --sepolia` (Phase 4) when ready",
  "- I did NOT register the token with the Confidential Token Registry — handled by `/zama-deploy`",
  "- I did NOT wire frontend encryption flows — run `/zama-frontend`",
].join("\n");

function nextSkillReason(useCase: string): string {
  switch (useCase) {
    case "confidential-token":
      return "extend Token.sol with confidential transfer / approval logic and ACL grants";
    case "voting":
      return "wire the VotesConfidential tally with proper ACL on the ballot handles";
    case "auction":
      return "flesh out sealed-bid logic with euint64 + FHE.le / FHE.select winner selection";
    case "custom":
      return "fill in your domain logic on top of the FHE.sol scaffold (ACL pattern reminders included)";
    default:
      return "extend the seed contract with domain logic and ACL grants";
  }
}

function renderCommandsPassed(cmds: CommandResult[]): string {
  const passed = cmds.filter((c) => c.ok);
  if (passed.length === 0) return "_(none recorded)_";
  return passed.map((c) => `- \`${c.cmd}\``).join("\n");
}

export function renderClosingSummary(
  manifest: ScaffoldManifest,
  ctx: ClosingSummaryContext,
): string {
  const sharedDir = ctx.sharedDir;
  const tmplPath = resolve(sharedDir, "prompts", "closing-summary.md");
  const versionsPath = resolve(sharedDir, "snippets", "versions-table.md");
  const faucetPath = resolve(sharedDir, "snippets", "sepolia-faucet.md");

  const tmplRaw = readFileSync(tmplPath, "utf8");
  const versionsTable = readFileSync(versionsPath, "utf8").trim();
  const faucetMd = readFileSync(faucetPath, "utf8").trim();

  const substrate = extractTemplate(tmplRaw);
  const skillName = ctx.skillName ?? "/zama-init";
  const filesCap = ctx.filesCap ?? 30;

  const replacements: Record<string, string> = {
    SKILL_NAME: skillName,
    INSTALLED_FILES: renderInstalledFiles(manifest.filesWritten, filesCap),
    VERSIONS_TABLE: versionsTable,
    SEPOLIA_FAUCET: faucetMd,
    NOT_DONE_LIST: NOT_DONE_LIST,
    NEXT_SKILL: "/zama-contract",
    NEXT_SKILL_REASON: nextSkillReason(ctx.useCase),
  };

  let body = substrate;
  for (const [key, value] of Object.entries(replacements)) {
    body = body.split(`{{${key}}}`).join(value);
  }

  // Append required tail lines verbatim — they survive even if template drifts.
  const tail: string[] = [
    "",
    META_MASK_LINE,
    "",
    CONTEXT7_LINE,
    "",
    "### Commands that already passed",
    renderCommandsPassed(manifest.commandsRan),
  ];

  return body.trimEnd() + "\n" + tail.join("\n") + "\n";
}

// ---------- CLI shim ----------

function defaultSharedDir(): string {
  // Walk up from this file: skills/init/scripts/closing-summary.ts
  // → plugins/zama-skills/shared/
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..", "shared");
}

interface CliArgs {
  manifestPath?: string;
  useCase: string;
  sharedDir: string;
}

function parseArgs(args: string[]): CliArgs {
  let manifestPath: string | undefined;
  let useCase = "custom";
  let sharedDir = defaultSharedDir();
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--manifest") {
      manifestPath = args[i + 1];
      i += 1;
    } else if (a === "--use-case") {
      useCase = args[i + 1] ?? useCase;
      i += 1;
    } else if (a === "--shared-dir") {
      sharedDir = args[i + 1] ?? sharedDir;
      i += 1;
    }
  }
  return { manifestPath, useCase, sharedDir };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

const isEntry =
  argv[1] !== undefined && fileURLToPath(import.meta.url) === argv[1];

if (isEntry) {
  void (async () => {
    const cli = parseArgs(argv.slice(2));
    let manifestJson: string;
    if (cli.manifestPath) {
      manifestJson = readFileSync(cli.manifestPath, "utf8");
    } else {
      manifestJson = await readStdin();
    }
    const parsed = JSON.parse(manifestJson) as
      | CanonicalScaffoldManifest
      | ScaffoldManifest;
    const manifest = coerceManifest(parsed);
    const out = renderClosingSummary(manifest, {
      useCase: cli.useCase,
      sharedDir: cli.sharedDir,
    });
    stdout.write(out);
    exit(0);
  })().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`closing-summary failed: ${msg}\n`);
    exit(1);
  });
}
