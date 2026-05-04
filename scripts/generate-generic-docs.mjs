#!/usr/bin/env node
/**
 * generate-generic-docs.mjs — DIST-02 (Phase 06-02).
 *
 * Reads each `plugins/zama-skills/skills/<name>/SKILL.md` and emits a generic
 * `generic/<name>.md` rehber suitable for non-Claude AI agents (Cursor / Copilot
 * / Codex / etc.). Output is deterministic so the CI drift gate
 * (`npm run generic:check`) can detect uncommitted SKILL.md edits.
 *
 * Output shape:
 *   1. Compact YAML frontmatter (fixed key order):
 *        name, description, when_to_use, source, source_sha, generator
 *   2. The original SKILL.md body, with `${CLAUDE_SKILL_DIR}` rewritten to
 *      `<plugin-skill-dir>` (a tool-agnostic placeholder).
 *   3. A "## Claude-specific notes" appendix preserving any Claude-only
 *      frontmatter values (allowed-tools, disable-model-invocation,
 *      context: fork) and explaining the placeholder substitution.
 *
 * Usage:
 *   node scripts/generate-generic-docs.mjs           # writes to ./generic/
 *   node scripts/generate-generic-docs.mjs --check   # exits 1 on drift
 *
 * Programmatic API:
 *   import { generateGenericDoc, generateAll } from "./generate-generic-docs.mjs";
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { resolve, join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const SKILLS_DIR = join(REPO_ROOT, "plugins", "zama-skills", "skills");
const DEFAULT_OUT_DIR = join(REPO_ROOT, "generic");

// Frontmatter keys we deliberately strip from rendered output and republish
// in the "Claude-specific notes" appendix. These are Claude-Code-only knobs
// that have no meaning for Cursor / Copilot / generic editors.
const CLAUDE_ONLY_KEYS = new Set([
  "allowed-tools",
  "disable-model-invocation",
]);
// `context: fork` is also Claude-only, but only the literal value `fork` —
// other context values (if introduced) would be surfaced normally.
const CLAUDE_FORK_CONTEXT = "fork";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parse a (very simple) YAML frontmatter block into an ordered list of
 * `{ key, value }` records. We intentionally do NOT use a full YAML parser
 * because SKILL.md frontmatter is single-line scalars only; pulling in a YAML
 * dep would add zero value and break the "zero-deps generator" promise.
 */
function parseFrontmatter(raw) {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { entries: [], body: raw };
  }
  const block = match[1];
  const body = raw.slice(match[0].length);
  const entries = [];
  for (const line of block.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue; // skip malformed lines (defensive)
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    entries.push({ key, value });
  }
  return { entries, body };
}

/**
 * Compute git blob SHA for a file (stable identifier independent of commit
 * history — same content -> same SHA, exactly what `git hash-object` returns).
 */
function gitHashObject(filePath) {
  return execSync(`git hash-object "${filePath}"`, {
    cwd: REPO_ROOT,
  })
    .toString()
    .trim();
}

/**
 * Compute the plugin-relative source path used in the `source:` frontmatter
 * field. We always emit POSIX-style separators because this string ends up in
 * markdown that may be browsed on any OS.
 */
function relativeSkillPath(skillPath) {
  const rel = skillPath.startsWith(REPO_ROOT)
    ? skillPath.slice(REPO_ROOT.length).replace(/^[\\/]+/, "")
    : skillPath;
  return rel.split(/[\\/]/).join("/");
}

/**
 * Generate a single generic doc string from a SKILL.md.
 *
 * Options:
 *   skillPath   — absolute path to a SKILL.md (used for source_sha + source).
 *   skillContent? — raw SKILL.md content (defaults to readFileSync(skillPath)).
 *   skillName?  — slug name (defaults to basename(dirname(skillPath))).
 */
export function generateGenericDoc({ skillPath, skillContent, skillName } = {}) {
  if (!skillPath) {
    throw new Error("generateGenericDoc: skillPath is required");
  }
  const raw = skillContent ?? readFileSync(skillPath, "utf8");
  const name = skillName ?? basename(dirname(skillPath));
  const sourceRel = relativeSkillPath(skillPath);
  const sourceSha = gitHashObject(skillPath);

  const { entries, body } = parseFrontmatter(raw);

  // Bucket frontmatter into (kept, claude-only).
  const kept = new Map();
  const claudeOnly = [];
  for (const { key, value } of entries) {
    if (CLAUDE_ONLY_KEYS.has(key)) {
      claudeOnly.push({ key, value });
      continue;
    }
    if (key === "context" && value === CLAUDE_FORK_CONTEXT) {
      claudeOnly.push({ key, value });
      continue;
    }
    kept.set(key, value);
  }

  // Fixed key order — determinism requirement (Test 7).
  const orderedKeys = ["name", "description", "when_to_use"];
  const fmLines = ["---"];
  for (const k of orderedKeys) {
    if (kept.has(k)) fmLines.push(`${k}: ${kept.get(k)}`);
  }
  // Then any other non-Claude keys in their original SKILL.md order
  // (preserves forward compatibility if SKILL.md gains new keys).
  for (const { key, value } of entries) {
    if (orderedKeys.includes(key)) continue;
    if (!kept.has(key)) continue;
    fmLines.push(`${key}: ${value}`);
  }
  // Provenance fields appended last, fixed order.
  fmLines.push(`source: ${sourceRel}`);
  fmLines.push(`source_sha: ${sourceSha}`);
  fmLines.push(`generator: scripts/generate-generic-docs.mjs`);
  fmLines.push("---");

  // Body transforms — currently only the CLAUDE_SKILL_DIR substitution.
  const transformedBody = body.replace(
    /\$\{CLAUDE_SKILL_DIR\}/g,
    "<plugin-skill-dir>",
  );

  // Header pointer + canonical-source note (visible in the rendered doc).
  const header = [
    `> Auto-generated from \`${sourceRel}\` by \`scripts/generate-generic-docs.mjs\`.`,
    `> Do not edit this file directly — edit the source SKILL.md and re-run \`node scripts/generate-generic-docs.mjs\`.`,
    `> Canonical SKILL.md SHA: \`${sourceSha}\` (CI gate: \`npm run generic:check\`).`,
  ].join("\n");

  // "Claude-specific notes" appendix — always present so generic readers
  // know what was filtered. Empty list still emits the section so the
  // structural contract is stable for downstream tooling.
  const appendixLines = ["## Claude-specific notes", ""];
  appendixLines.push(
    "The canonical SKILL.md targets [Claude Code](https://code.claude.com/docs/en/skills). " +
      "The keys below are Claude-Code-only and have been stripped from the rendered " +
      "frontmatter above; non-Claude agents can ignore them.",
  );
  appendixLines.push("");
  if (claudeOnly.length === 0) {
    appendixLines.push("_None — this skill uses no Claude-specific frontmatter keys._");
  } else {
    appendixLines.push("```yaml");
    for (const { key, value } of claudeOnly) {
      appendixLines.push(`${key}: ${value}`);
    }
    appendixLines.push("```");
  }
  appendixLines.push("");
  // NOTE: we deliberately avoid embedding the literal `${CLAUDE_SKILL_DIR}`
  // token in the appendix so the test (and any downstream grep-based gate)
  // can use that substring as a sentinel for "untransformed body". Refer to
  // it in prose form ("the Claude skill-dir variable") instead.
  appendixLines.push(
    "**Path placeholder:** the Claude skill-dir variable used by SKILL.md has been " +
      "rewritten to `<plugin-skill-dir>` throughout the body. When adapting this rehber " +
      "for another tool, substitute `<plugin-skill-dir>` with the absolute path to the " +
      "installed skill directory in your environment.",
  );

  // Assemble. Single trailing newline (deterministic).
  const out =
    fmLines.join("\n") +
    "\n\n" +
    header +
    "\n\n" +
    transformedBody.replace(/^\s+/, "").replace(/\s+$/, "") +
    "\n\n" +
    appendixLines.join("\n") +
    "\n";

  return out;
}

/**
 * Enumerate skill directories under `plugins/zama-skills/skills/` that contain
 * a SKILL.md. Hidden / underscore-prefixed dirs (e.g. `_lib`) are skipped.
 */
function listSkillNames() {
  if (!existsSync(SKILLS_DIR)) return [];
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => !name.startsWith("_") && !name.startsWith("."))
    .filter((name) => existsSync(join(SKILLS_DIR, name, "SKILL.md")))
    .sort();
}

/**
 * Generate every generic doc and write to `outDir` (defaults to `./generic/`).
 * Returns the list of absolute paths that were written.
 */
export async function generateAll({ outDir = DEFAULT_OUT_DIR } = {}) {
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  const written = [];
  for (const name of listSkillNames()) {
    const skillPath = join(SKILLS_DIR, name, "SKILL.md");
    const content = generateGenericDoc({ skillPath, skillName: name });
    const target = join(outDir, `${name}.md`);
    writeFileSync(target, content, "utf8");
    written.push(target);
  }
  return written;
}

// CLI entrypoint.
const invokedDirect =
  process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
if (invokedDirect) {
  const check = process.argv.includes("--check");
  if (check) {
    // Generate into a memory buffer per-file and diff against on-disk content.
    const drift = [];
    for (const name of listSkillNames()) {
      const skillPath = join(SKILLS_DIR, name, "SKILL.md");
      const expected = generateGenericDoc({ skillPath, skillName: name });
      const target = join(DEFAULT_OUT_DIR, `${name}.md`);
      const actual = existsSync(target) ? readFileSync(target, "utf8") : "";
      if (actual !== expected) drift.push(target);
    }
    if (drift.length > 0) {
      console.error(
        `Generic docs drift detected in ${drift.length} file(s):`,
      );
      for (const f of drift) console.error(`  - ${f}`);
      console.error(
        "\nRun `node scripts/generate-generic-docs.mjs` and commit the result.",
      );
      process.exit(1);
    }
    console.log(`✓ Generic docs in sync (${listSkillNames().length} skill(s))`);
  } else {
    const written = await generateAll({});
    console.log(`✓ Wrote ${written.length} generic doc(s):`);
    for (const p of written) console.log(`  - ${p}`);
  }
}
