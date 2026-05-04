import fs from 'fs-extra';
import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';

export type InstallScope = 'personal' | 'project';

export interface InstallOptions {
  scope: InstallScope;
  /** Root directory under which `.claude/skills/zama-skills/` will be created. */
  targetRoot: string;
  /** Source directory containing `<skill>/SKILL.md` subfolders. */
  sourceRoot: string;
  /** When true, overwrite existing files at the destination without prompting. */
  force?: boolean;
}

export interface InstallResult {
  written: number;
  scope: InstallScope;
  /** Absolute path of the destination `.claude/skills/zama-skills/` directory. */
  target: string;
}

/**
 * Discover skill subdirectories that contain a SKILL.md.
 */
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

/**
 * Copy bundled skill folders into the user's Claude Code skills directory.
 *
 * Layout written:
 *   <targetRoot>/.claude/skills/zama-skills/<skill>/SKILL.md
 *
 * @throws if `sourceRoot` contains no `<dir>/SKILL.md` entries.
 */
export async function installSkills(opts: InstallOptions): Promise<InstallResult> {
  const { scope, targetRoot, sourceRoot, force = false } = opts;

  const skills = await findSkillDirs(sourceRoot);
  if (skills.length === 0) {
    throw new Error(`No skills found in sourceRoot: ${sourceRoot} (expected <dir>/SKILL.md)`);
  }

  const target = path.join(targetRoot, '.claude', 'skills', 'zama-skills');
  await fs.ensureDir(target);

  let written = 0;
  for (const name of skills) {
    const src = path.join(sourceRoot, name);
    const dst = path.join(target, name);
    await fs.copy(src, dst, {
      overwrite: force,
      errorOnExist: !force,
      recursive: true,
    });
    written += 1;
  }

  return { written, scope, target };
}

/**
 * Probe whether installing would overwrite any existing files.
 */
export async function destinationHasExisting(targetRoot: string): Promise<boolean> {
  const target = path.join(targetRoot, '.claude', 'skills', 'zama-skills');
  if (!(await fs.pathExists(target))) return false;
  const entries = await readdir(target);
  return entries.length > 0;
}
