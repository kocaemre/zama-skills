import fs from 'fs-extra';
import path from 'node:path';
import { readdir, stat, readFile, writeFile } from 'node:fs/promises';

import { findTarget, type Target, type TargetId } from './targets.js';

export type InstallScope = 'personal' | 'project';

export interface InstallOptions {
  scope: InstallScope;
  /** Project root (cwd) — used for project-local installs. */
  projectRoot: string;
  /** Home root ($HOME) — used when a target is installed globally. */
  homeRoot: string;
  /**
   * Which targets should be installed under $HOME instead of cwd.
   * Only meaningful for targets that have `supportsGlobalScope: true`
   * (claude-code, generic). Others always install under projectRoot.
   */
  globalTargets?: Set<TargetId>;
  /** Source dir containing `<skill>/SKILL.md` subfolders (Claude Code bundle). */
  sourceRoot: string;
  /** Source dir containing `<skill>.md` generic markdown rules. */
  genericRoot: string;
  /** Which AI tools to install for. */
  targets: TargetId[];
  /** When true, overwrite existing files at the destination without prompting. */
  force?: boolean;
}

function rootFor(target: Target, opts: InstallOptions): string {
  if (target.supportsGlobalScope && opts.globalTargets?.has(target.id)) {
    return opts.homeRoot;
  }
  return opts.projectRoot;
}

export interface InstalledTarget {
  target: TargetId;
  destDir: string;
  written: number;
  entryPointAppended?: string;
}

export interface InstallResult {
  scope: InstallScope;
  installed: InstalledTarget[];
}

/** Discover skill subdirectories that contain a SKILL.md (bundle source). */
async function findSkillDirs(sourceRoot: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(sourceRoot);
  } catch (err) {
    throw new Error(`sourceRoot not readable: ${sourceRoot} (${(err as Error).message})`);
  }
  const found: string[] = [];
  for (const name of entries) {
    if (name.startsWith('.') || name.startsWith('_')) continue;
    const dir = path.join(sourceRoot, name);
    let isDir = false;
    try {
      isDir = (await stat(dir)).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;
    const skillFile = path.join(dir, 'SKILL.md');
    if (await fs.pathExists(skillFile)) {
      found.push(name);
    }
  }
  return found;
}

/** Discover `<skill>.md` files in the generic dir. */
async function findGenericDocs(genericRoot: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(genericRoot);
  } catch (err) {
    throw new Error(`genericRoot not readable: ${genericRoot} (${(err as Error).message})`);
  }
  return entries.filter((n) => n.endsWith('.md') && !n.startsWith('.'));
}

const ENTRY_BLOCK_BEGIN = '<!-- BEGIN zama-skills install pointer -->';
const ENTRY_BLOCK_END = '<!-- END zama-skills install pointer -->';

function entryBlock(rulesRelative: string): string {
  return [
    ENTRY_BLOCK_BEGIN,
    '',
    '## zama-skills',
    '',
    `Skill rules for building confidential dApps with the Zama Protocol (fhEVM) live under \`${rulesRelative}/\`.`,
    'When the user asks for confidential token / voting / auction work, read the relevant skill markdown there and follow its "Hard rules" section verbatim.',
    'Pipeline order: design → init → contract → test → audit → deploy → frontend.',
    '',
    'Never import `fhevmjs` or `fhevm` (root pkg) — both deprecated 2025-07-10. Use `@zama-fhe/relayer-sdk` and `@fhevm/solidity` instead.',
    '',
    ENTRY_BLOCK_END,
    '',
  ].join('\n');
}

/** Idempotent append: replaces existing block, or appends a new one. */
async function appendEntryPointer(filePath: string, rulesRelative: string): Promise<void> {
  let existing = '';
  if (await fs.pathExists(filePath)) {
    existing = await readFile(filePath, 'utf8');
  }
  const block = entryBlock(rulesRelative);
  const beginIdx = existing.indexOf(ENTRY_BLOCK_BEGIN);
  const endIdx = existing.indexOf(ENTRY_BLOCK_END);
  let next: string;
  if (beginIdx >= 0 && endIdx > beginIdx) {
    const before = existing.slice(0, beginIdx);
    const after = existing.slice(endIdx + ENTRY_BLOCK_END.length);
    next = before + block + after.replace(/^\n+/, '');
  } else if (existing.length === 0) {
    next = `# AI agent rules\n\n${block}`;
  } else {
    next = existing.replace(/\n+$/, '') + '\n\n' + block;
  }
  await fs.ensureDir(path.dirname(filePath));
  await writeFile(filePath, next, 'utf8');
}

async function installBundle(target: Target, opts: InstallOptions): Promise<InstalledTarget> {
  const { sourceRoot, force = false } = opts;
  const targetRoot = rootFor(target, opts);
  const skills = await findSkillDirs(sourceRoot);
  if (skills.length === 0) {
    throw new Error(`No skills found in sourceRoot: ${sourceRoot}`);
  }
  const dest = target.destDir(targetRoot);
  await fs.ensureDir(dest);
  let written = 0;
  for (const name of skills) {
    const src = path.join(sourceRoot, name);
    const dst = path.join(dest, name);
    await fs.copy(src, dst, { overwrite: force, errorOnExist: !force });
    written += 1;
  }
  return { target: target.id, destDir: dest, written };
}

async function installGeneric(target: Target, opts: InstallOptions): Promise<InstalledTarget> {
  const { genericRoot, force = false } = opts;
  const targetRoot = rootFor(target, opts);
  const docs = await findGenericDocs(genericRoot);
  if (docs.length === 0) {
    throw new Error(`No generic docs found at ${genericRoot}.`);
  }
  const dest = target.destDir(targetRoot);
  await fs.ensureDir(dest);
  let written = 0;
  for (const name of docs) {
    const src = path.join(genericRoot, name);
    const dst = path.join(dest, name);
    await fs.copy(src, dst, { overwrite: force, errorOnExist: !force });
    written += 1;
  }
  // Drop a tiny README so users can hand-point any other AI at the dir.
  const readmePath = path.join(dest, 'README.md');
  const readme = [
    '# zama-skills knowledge pack',
    '',
    `Generated by \`npx zama-skills install\` for the **${target.label}** target.`,
    '',
    'Each `<skill>.md` is a self-contained rule set for one capability:',
    '',
    '- `init.md` — scaffold a new fhEVM monorepo',
    '- `design.md` — produce DESIGN.md + UI-WIREFRAME.md from a use-case',
    '- `contract.md` — author confidential Solidity contracts (ERC7984 / Votes / custom)',
    '- `test.md` — generate mock + Sepolia tests',
    '- `audit.md` — FHE-aware code review (ACL / cleartext / HCU / deprecation)',
    '- `deploy.md` — Sepolia deploy + Etherscan verify (manual confirm)',
    '- `frontend.md` — wire @zama-fhe/relayer-sdk + 4-state UX hook',
    '- `debug.md` — match an FHE error to root cause + fix command',
    '- `doctor.md` — environment diagnostic',
    '- `autonomous.md` — run the full pipeline end-to-end',
    '',
    'Pipeline order: **design → init → contract → test → audit → deploy → frontend**.',
    '',
    'Hard rules to enforce regardless of which file the user is in:',
    '',
    '- Never emit code that imports `fhevmjs` or `fhevm` (root pkg) — both deprecated 2025-07-10.',
    '- Always pair `euint*` storage writes with `FHE.allowThis(...)`; expose to caller via `FHE.allow(value, msg.sender)`.',
    '- Never `require(decrypt(...))` — use `FHE.lt`/`FHE.eq` returning `ebool`.',
    '- Never pin Sepolia contract addresses in source — fetch live from `https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia`.',
    '',
  ].join('\n');
  await writeFile(readmePath, readme, 'utf8');
  written += 1;
  let entryPointAppended: string | undefined;
  if (target.entryPoint) {
    const ep = target.entryPoint(targetRoot);
    const rulesRelative = path.relative(targetRoot, dest) || dest;
    await appendEntryPointer(ep, rulesRelative);
    entryPointAppended = ep;
  }
  return { target: target.id, destDir: dest, written, entryPointAppended };
}

/**
 * Install zama-skills bundles + generic rules for one or more AI-tool targets.
 *
 * Per-target layout:
 *   claude-code → <targetRoot>/.claude/skills/zama-skills/<skill>/SKILL.md (full bundle)
 *   cursor      → <targetRoot>/.cursor/rules/zama-skills/<skill>.md (generic)
 *   opencode    → <targetRoot>/.opencode/rules/zama-skills/<skill>.md + AGENTS.md pointer
 *   codex       → <targetRoot>/.codex/rules/zama-skills/<skill>.md + AGENTS.md pointer
 *   aider       → <targetRoot>/.aider/zama-skills/<skill>.md + CONVENTIONS.md pointer
 *   continue    → <targetRoot>/.continue/rules/zama-skills/<skill>.md
 *   generic     → <targetRoot>/zama-skills-knowledge/<skill>.md + README
 */
export async function installSkills(opts: InstallOptions): Promise<InstallResult> {
  if (opts.targets.length === 0) {
    throw new Error('No install targets selected.');
  }
  const installed: InstalledTarget[] = [];
  for (const id of opts.targets) {
    const target = findTarget(id);
    if (target.assetShape === 'bundle') {
      installed.push(await installBundle(target, opts));
    } else {
      installed.push(await installGeneric(target, opts));
    }
  }
  return { scope: opts.scope, installed };
}

export interface UninstallOptions {
  projectRoot: string;
  homeRoot: string;
  globalTargets?: Set<TargetId>;
  targets: TargetId[];
}

export interface UninstalledTarget {
  target: TargetId;
  destDir: string;
  removed: boolean;
  entryPointStripped?: string;
}

export interface UninstallResult {
  uninstalled: UninstalledTarget[];
}

/** Strip the zama-skills pointer block from an entry point file, leaving the rest intact. */
async function stripEntryPointer(filePath: string): Promise<boolean> {
  if (!(await fs.pathExists(filePath))) return false;
  const existing = await readFile(filePath, 'utf8');
  const beginIdx = existing.indexOf(ENTRY_BLOCK_BEGIN);
  const endIdx = existing.indexOf(ENTRY_BLOCK_END);
  if (beginIdx < 0 || endIdx <= beginIdx) return false;
  const before = existing.slice(0, beginIdx).replace(/\n+$/, '');
  const after = existing.slice(endIdx + ENTRY_BLOCK_END.length).replace(/^\n+/, '');
  // If the file becomes nothing-but-our-scaffold ("# AI agent rules"), drop it entirely.
  const stripped = (before + (before && after ? '\n\n' : '') + after).trim();
  if (stripped === '' || stripped === '# AI agent rules') {
    await fs.remove(filePath);
  } else {
    await writeFile(filePath, stripped + '\n', 'utf8');
  }
  return true;
}

export async function uninstallSkills(opts: UninstallOptions): Promise<UninstallResult> {
  if (opts.targets.length === 0) throw new Error('No uninstall targets selected.');
  const out: UninstalledTarget[] = [];
  for (const id of opts.targets) {
    const target = findTarget(id);
    const root = target.supportsGlobalScope && opts.globalTargets?.has(id) ? opts.homeRoot : opts.projectRoot;
    const dest = target.destDir(root);
    let removed = false;
    if (await fs.pathExists(dest)) {
      await fs.remove(dest);
      removed = true;
    }
    let entryPointStripped: string | undefined;
    if (target.entryPoint) {
      const ep = target.entryPoint(root);
      if (await stripEntryPointer(ep)) entryPointStripped = ep;
    }
    out.push({ target: id, destDir: dest, removed, entryPointStripped });
  }
  return { uninstalled: out };
}

export async function destinationHasExisting(
  projectRoot: string,
  homeRoot: string,
  targetIds: TargetId[],
  globalTargets?: Set<TargetId>,
): Promise<boolean> {
  for (const id of targetIds) {
    const target = findTarget(id);
    const root = target.supportsGlobalScope && globalTargets?.has(id) ? homeRoot : projectRoot;
    const dest = target.destDir(root);
    if (!(await fs.pathExists(dest))) continue;
    const entries = await readdir(dest);
    if (entries.length > 0) return true;
  }
  return false;
}
