import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { installSkills } from './install.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const realSourceRoot = path.resolve(repoRoot, 'plugins', 'zama-skills', 'skills');

const SKILL_NAMES = ['contract', 'deploy', 'frontend', 'init', 'test'];

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

describe('installSkills', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'zama-skills-test-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('Test 1: copies all 5 skill folders into <targetRoot>/.claude/skills/zama-skills/<name>/SKILL.md (personal scope)', async () => {
    const result = await installSkills({
      scope: 'personal',
      targetRoot: tmp,
      sourceRoot: realSourceRoot,
      force: true,
    });

    expect(result.written).toBeGreaterThanOrEqual(SKILL_NAMES.length);
    for (const name of SKILL_NAMES) {
      const skillPath = path.join(tmp, '.claude', 'skills', 'zama-skills', name, 'SKILL.md');
      expect(await fileExists(skillPath)).toBe(true);
    }
  });

  it('Test 2: --scope project writes to <cwd>/.claude/skills/zama-skills/', async () => {
    const result = await installSkills({
      scope: 'project',
      targetRoot: tmp,
      sourceRoot: realSourceRoot,
      force: true,
    });

    expect(result.scope).toBe('project');
    expect(result.target).toBe(path.join(tmp, '.claude', 'skills', 'zama-skills'));
    expect(await fileExists(path.join(tmp, '.claude', 'skills', 'zama-skills', 'init', 'SKILL.md'))).toBe(true);
  });

  it('Test 3: with force=true, overwrites existing files at destination', async () => {
    const dest = path.join(tmp, '.claude', 'skills', 'zama-skills', 'init');
    await mkdir(dest, { recursive: true });
    await writeFile(path.join(dest, 'SKILL.md'), 'OLD CONTENT');

    await installSkills({
      scope: 'project',
      targetRoot: tmp,
      sourceRoot: realSourceRoot,
      force: true,
    });

    const content = await readFile(path.join(dest, 'SKILL.md'), 'utf8');
    expect(content).not.toBe('OLD CONTENT');
    expect(content.length).toBeGreaterThan(20);
  });

  it('Test 4: returns { written, scope, target } summary', async () => {
    const result = await installSkills({
      scope: 'personal',
      targetRoot: tmp,
      sourceRoot: realSourceRoot,
      force: true,
    });

    expect(result).toHaveProperty('written');
    expect(result).toHaveProperty('scope', 'personal');
    expect(result).toHaveProperty('target');
    expect(typeof result.written).toBe('number');
    expect(typeof result.target).toBe('string');
  });

  it('Test 5: throws if sourceRoot has no */SKILL.md', async () => {
    const emptySrc = path.join(tmp, 'empty-src');
    await mkdir(emptySrc, { recursive: true });

    await expect(
      installSkills({
        scope: 'project',
        targetRoot: tmp,
        sourceRoot: emptySrc,
        force: true,
      }),
    ).rejects.toThrow();
  });
});
