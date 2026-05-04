/**
 * targets.ts — supported AI-tool install targets for zama-skills.
 *
 * Each target describes WHERE skill bundles should land for a given tool,
 * which asset format the tool prefers (full bundle vs. generic markdown),
 * and how to detect whether the tool is configured in the user's project.
 *
 * Adding a new tool: append to TARGETS, write a `Materializer` function
 * in install.ts that knows how to format files for it.
 */

import fs from 'fs-extra';
import path from 'node:path';

export type TargetId =
  | 'claude-code'
  | 'cursor'
  | 'opencode'
  | 'aider'
  | 'continue'
  | 'codex'
  | 'generic';

export interface Target {
  id: TargetId;
  /** Short label shown in the interactive picker. */
  label: string;
  /** One-line description shown beside the label. */
  description: string;
  /**
   * Asset shape this tool consumes.
   * - 'bundle'  → full SKILL.md + scripts/ + assets/ (Claude Code only)
   * - 'generic' → one stripped markdown per skill (any AI agent that reads markdown rules)
   */
  assetShape: 'bundle' | 'generic';
  /**
   * Function that returns the install dir for this tool, relative to targetRoot.
   * Example: 'cursor' returns '.cursor/rules/zama-skills'.
   */
  destDir: (targetRoot: string) => string;
  /**
   * Optional file the tool reads as a master entry point. If set, the installer
   * will append a small "see also" section pointing at the rules dir, idempotent.
   */
  entryPoint?: (targetRoot: string) => string;
  /** One-line hint printed after a successful install. */
  postInstallHint: (targetRoot: string) => string;
  /**
   * True if the tool reads from a global ($HOME) rules dir in addition to project-local.
   * Used by the CLI to warn users that --scope personal will silently no-op for tools
   * that only honor project-local rules.
   *
   * - claude-code: true (~/.claude/skills is real, picked up across all projects)
   * - everything else: false (project-local only — Cursor / OpenCode / Codex / Aider /
   *   Continue all key off the cwd)
   */
  supportsGlobalScope: boolean;
  /**
   * Heuristic: returns true if the project at targetRoot looks like it uses this tool.
   * Used for auto-suggest in the interactive picker.
   */
  detect: (targetRoot: string) => Promise<boolean>;
}

const exists = async (p: string): Promise<boolean> => {
  try {
    return await fs.pathExists(p);
  } catch {
    return false;
  }
};

export const TARGETS: Target[] = [
  {
    id: 'claude-code',

    supportsGlobalScope: true,
    label: 'Claude Code',
    description: 'Native plugin (slash commands, auto-routing, closing-summary chain)',
    assetShape: 'bundle',
    destDir: (root) => path.join(root, '.claude', 'skills', 'zama-skills'),
    postInstallHint: (root) =>
      `Open Claude Code in this directory, then type /zama-doctor to verify, /zama-autonomous to run the full pipeline.`,
    detect: async (root) =>
      (await exists(path.join(root, '.claude'))) ||
      (await exists(path.join(root, '.claude-plugin'))) ||
      (await exists(path.join(root, 'CLAUDE.md'))),
  },
  {
    id: 'cursor',

    supportsGlobalScope: false,
    label: 'Cursor',
    description: 'Rules under .cursor/rules/zama-skills/ — read by Cursor agents and Composer',
    assetShape: 'generic',
    destDir: (root) => path.join(root, '.cursor', 'rules', 'zama-skills'),
    postInstallHint: (root) =>
      `Cursor will pick the rules up automatically. Try: "init a confidential token dApp" in Composer.`,
    detect: async (root) =>
      (await exists(path.join(root, '.cursor'))) ||
      (await exists(path.join(root, '.cursorrules'))) ||
      (await exists(path.join(root, '.cursorignore'))),
  },
  {
    id: 'opencode',

    supportsGlobalScope: false,
    label: 'OpenCode',
    description: 'Rules under .opencode/rules/zama-skills/ + AGENTS.md pointer',
    assetShape: 'generic',
    destDir: (root) => path.join(root, '.opencode', 'rules', 'zama-skills'),
    entryPoint: (root) => path.join(root, 'AGENTS.md'),
    postInstallHint: (root) =>
      `OpenCode reads AGENTS.md — a "See also" section was appended pointing at the new rules.`,
    detect: async (root) =>
      (await exists(path.join(root, '.opencode'))) ||
      (await exists(path.join(root, 'AGENTS.md'))),
  },
  {
    id: 'codex',

    supportsGlobalScope: false,
    label: 'Codex CLI (OpenAI)',
    description: 'AGENTS.md convention + .codex/rules/zama-skills/ for skill content',
    assetShape: 'generic',
    destDir: (root) => path.join(root, '.codex', 'rules', 'zama-skills'),
    entryPoint: (root) => path.join(root, 'AGENTS.md'),
    postInstallHint: (root) =>
      `Codex CLI scans AGENTS.md — a "See also" section was appended pointing at the new rules.`,
    detect: async (root) => await exists(path.join(root, '.codex')),
  },
  {
    id: 'aider',

    supportsGlobalScope: false,
    label: 'Aider',
    description: 'Rules under .aider/zama-skills/ + CONVENTIONS.md pointer',
    assetShape: 'generic',
    destDir: (root) => path.join(root, '.aider', 'zama-skills'),
    entryPoint: (root) => path.join(root, 'CONVENTIONS.md'),
    postInstallHint: (root) =>
      `Aider can be pointed at the rules via: aider --read CONVENTIONS.md (already references the new rules).`,
    detect: async (root) =>
      (await exists(path.join(root, '.aider.conf.yml'))) ||
      (await exists(path.join(root, '.aider.conf.yaml'))) ||
      (await exists(path.join(root, '.aiderignore'))),
  },
  {
    id: 'continue',

    supportsGlobalScope: false,
    label: 'Continue (VS Code / JetBrains)',
    description: 'Rules under .continue/rules/zama-skills/ — read by Continue agent context',
    assetShape: 'generic',
    destDir: (root) => path.join(root, '.continue', 'rules', 'zama-skills'),
    postInstallHint: (root) =>
      `Continue reads .continue/rules/ as agent context. Restart the Continue panel after install.`,
    detect: async (root) => await exists(path.join(root, '.continue')),
  },
  {
    id: 'generic',

    supportsGlobalScope: true,
    label: 'Generic (any AI tool)',
    description: 'Drop the markdown rules under zama-skills-knowledge/ — point your tool at it',
    assetShape: 'generic',
    destDir: (root) => path.join(root, 'zama-skills-knowledge'),
    postInstallHint: (root) =>
      `Tell your AI agent to read zama-skills-knowledge/README.md and follow per-skill rules.`,
    detect: async () => false, // never auto-suggested; manual choice
  },
];

export function findTarget(id: TargetId): Target {
  const t = TARGETS.find((x) => x.id === id);
  if (!t) {
    throw new Error(
      `Unknown install target: "${id}". Valid: ${TARGETS.map((x) => x.id).join(', ')}.`,
    );
  }
  return t;
}

export async function detectTargets(targetRoot: string): Promise<TargetId[]> {
  const out: TargetId[] = [];
  for (const t of TARGETS) {
    if (t.id === 'generic') continue;
    if (await t.detect(targetRoot)) out.push(t.id);
  }
  return out;
}
