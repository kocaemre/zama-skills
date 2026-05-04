import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, stat, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { installSkills, uninstallSkills, destinationHasExisting } from './install.js';
import { symlink, mkdir } from 'node:fs/promises';
import { TARGETS, findTarget, detectTargets } from './targets.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const realSourceRoot = path.resolve(repoRoot, 'plugins', 'zama-skills', 'skills');
const realGenericRoot = path.resolve(repoRoot, 'generic');

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'zama-skills-test-'));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('TARGETS catalogue', () => {
  it('lists all 7 supported tools', () => {
    const ids = TARGETS.map((t) => t.id).sort();
    expect(ids).toEqual([
      'aider',
      'claude-code',
      'codex',
      'continue',
      'cursor',
      'generic',
      'opencode',
    ]);
  });

  it('every target has a unique destDir', () => {
    const dirs = TARGETS.map((t) => t.destDir('/tmp/x'));
    expect(new Set(dirs).size).toBe(dirs.length);
  });

  it('claude-code uses bundle shape, others use generic', () => {
    expect(findTarget('claude-code').assetShape).toBe('bundle');
    for (const t of TARGETS) {
      if (t.id === 'claude-code') continue;
      expect(t.assetShape, `${t.id} should be generic`).toBe('generic');
    }
  });
});

describe('detectTargets', () => {
  it('detects claude-code when CLAUDE.md exists', async () => {
    await writeFile(path.join(tmp, 'CLAUDE.md'), '# claude\n', 'utf8');
    const detected = await detectTargets(tmp);
    expect(detected).toContain('claude-code');
  });

  it('detects cursor when .cursorrules exists', async () => {
    await writeFile(path.join(tmp, '.cursorrules'), 'rules', 'utf8');
    expect(await detectTargets(tmp)).toContain('cursor');
  });

  it('detects opencode when AGENTS.md exists', async () => {
    await writeFile(path.join(tmp, 'AGENTS.md'), '# agents', 'utf8');
    expect(await detectTargets(tmp)).toContain('opencode');
  });

  it('detects nothing in an empty dir', async () => {
    expect(await detectTargets(tmp)).toEqual([]);
  });
});

describe('installSkills — claude-code (bundle)', () => {
  it('copies all 10 skill folders with SKILL.md preserved', async () => {
    const result = await installSkills({
      scope: 'project',
      projectRoot: tmp, homeRoot: tmp,
      sourceRoot: realSourceRoot,
      genericRoot: realGenericRoot,
      targets: ['claude-code'],
      force: true,
    });
    expect(result.installed).toHaveLength(1);
    const it = result.installed[0]!;
    expect(it.target).toBe('claude-code');
    expect(it.written).toBe(10);
    // Each skill is copied flat with a zama- prefix so Claude Code's auto-discovery
    // at .claude/skills/<name>/SKILL.md picks them up directly.
    for (const name of [
      'zama-init', 'zama-contract', 'zama-test', 'zama-deploy', 'zama-frontend',
      'zama-design', 'zama-audit', 'zama-debug', 'zama-doctor', 'zama-autonomous',
    ]) {
      expect(await fileExists(path.join(it.destDir, name, 'SKILL.md'))).toBe(true);
    }
  });

  it('preserves disable-model-invocation in zama-deploy/SKILL.md', async () => {
    const result = await installSkills({
      scope: 'project',
      projectRoot: tmp, homeRoot: tmp,
      sourceRoot: realSourceRoot,
      genericRoot: realGenericRoot,
      targets: ['claude-code'],
      force: true,
    });
    const deploy = await readFile(
      path.join(result.installed[0]!.destDir, 'zama-deploy', 'SKILL.md'),
      'utf8',
    );
    expect(deploy).toMatch(/disable-model-invocation:\s*true/);
  });
});

describe('installSkills — cursor (generic)', () => {
  it('drops generic markdown under .cursor/rules/zama-skills/', async () => {
    const result = await installSkills({
      scope: 'project',
      projectRoot: tmp, homeRoot: tmp,
      sourceRoot: realSourceRoot,
      genericRoot: realGenericRoot,
      targets: ['cursor'],
      force: true,
    });
    const it = result.installed[0]!;
    expect(it.destDir).toBe(path.join(tmp, '.cursor', 'rules', 'zama-skills'));
    expect(await fileExists(path.join(it.destDir, 'init.md'))).toBe(true);
    expect(await fileExists(path.join(it.destDir, 'README.md'))).toBe(true);
    const init = await readFile(path.join(it.destDir, 'init.md'), 'utf8');
    // generic markdown moves Claude-specific keys out of frontmatter into an appendix
    const fm = init.match(/^---\n([\s\S]*?)\n---/);
    expect(fm).toBeTruthy();
    expect(fm![1]).not.toMatch(/^allowed-tools:/m);
  });
});

describe('installSkills — opencode (generic + AGENTS.md pointer)', () => {
  it('appends a pointer block to AGENTS.md', async () => {
    const result = await installSkills({
      scope: 'project',
      projectRoot: tmp, homeRoot: tmp,
      sourceRoot: realSourceRoot,
      genericRoot: realGenericRoot,
      targets: ['opencode'],
      force: true,
    });
    const it = result.installed[0]!;
    expect(it.entryPointAppended).toBe(path.join(tmp, 'AGENTS.md'));
    const agents = await readFile(path.join(tmp, 'AGENTS.md'), 'utf8');
    expect(agents).toMatch(/BEGIN zama-skills install pointer/);
    expect(agents).toMatch(/END zama-skills install pointer/);
    expect(agents).toMatch(/zama-skills/);
  });

  it('replaces an existing pointer block instead of duplicating it (idempotent)', async () => {
    await installSkills({
      scope: 'project', projectRoot: tmp, homeRoot: tmp, sourceRoot: realSourceRoot, genericRoot: realGenericRoot,
      targets: ['opencode'], force: true,
    });
    await installSkills({
      scope: 'project', projectRoot: tmp, homeRoot: tmp, sourceRoot: realSourceRoot, genericRoot: realGenericRoot,
      targets: ['opencode'], force: true,
    });
    const agents = await readFile(path.join(tmp, 'AGENTS.md'), 'utf8');
    const beginMatches = (agents.match(/BEGIN zama-skills install pointer/g) ?? []).length;
    expect(beginMatches).toBe(1);
  });
});

describe('installSkills — multi-target install', () => {
  it('installs for cursor + opencode + claude-code in one call', async () => {
    const result = await installSkills({
      scope: 'project',
      projectRoot: tmp, homeRoot: tmp,
      sourceRoot: realSourceRoot,
      genericRoot: realGenericRoot,
      targets: ['claude-code', 'cursor', 'opencode'],
      force: true,
    });
    expect(result.installed).toHaveLength(3);
    expect(await fileExists(path.join(tmp, '.claude', 'skills', 'zama-init', 'SKILL.md'))).toBe(true);
    expect(await fileExists(path.join(tmp, '.cursor', 'rules', 'zama-skills', 'init.md'))).toBe(true);
    expect(await fileExists(path.join(tmp, '.opencode', 'rules', 'zama-skills', 'init.md'))).toBe(true);
    expect(await fileExists(path.join(tmp, 'AGENTS.md'))).toBe(true);
  });
});

describe('destinationHasExisting', () => {
  it('returns false when nothing installed yet', async () => {
    expect(await destinationHasExisting(tmp, tmp, ['claude-code', 'cursor'])).toBe(false);
  });

  it('returns true after installing claude-code', async () => {
    await installSkills({
      scope: 'project', projectRoot: tmp, homeRoot: tmp, sourceRoot: realSourceRoot, genericRoot: realGenericRoot,
      targets: ['claude-code'], force: true,
    });
    expect(await destinationHasExisting(tmp, tmp, ['claude-code'])).toBe(true);
  });
});

describe('install marker + uninstall safety', () => {
  it('drops a .zama-skills-installed marker after install (claude-code)', async () => {
    const r = await installSkills({
      scope: 'project', projectRoot: tmp, homeRoot: tmp,
      sourceRoot: realSourceRoot, genericRoot: realGenericRoot,
      targets: ['claude-code'], force: true,
    });
    expect(await fileExists(path.join(r.installed[0]!.destDir, '.zama-skills-installed'))).toBe(true);
  });

  it('drops a .zama-skills-installed marker after install (generic target)', async () => {
    const r = await installSkills({
      scope: 'project', projectRoot: tmp, homeRoot: tmp,
      sourceRoot: realSourceRoot, genericRoot: realGenericRoot,
      targets: ['cursor'], force: true,
    });
    expect(await fileExists(path.join(r.installed[0]!.destDir, '.zama-skills-installed'))).toBe(true);
  });

  it('uninstall refuses to touch claude-code skills dir without marker', async () => {
    // Pre-populate .claude/skills/ with a foreign skill folder + a user note.
    const skillsDir = path.join(tmp, '.claude', 'skills');
    await mkdir(path.join(skillsDir, 'other-plugin', 'foo'), { recursive: true });
    await writeFile(path.join(skillsDir, 'other-plugin', 'foo', 'SKILL.md'), 'foreign\n', 'utf8');
    await writeFile(path.join(skillsDir, 'user-notes.md'), '# my notes\n', 'utf8');
    await expect(
      uninstallSkills({
        projectRoot: tmp, homeRoot: tmp,
        targets: ['claude-code'],
      }),
    ).rejects.toThrow(/not a zama-skills install/);
    // Foreign content untouched.
    expect(await fileExists(path.join(skillsDir, 'other-plugin', 'foo', 'SKILL.md'))).toBe(true);
    expect(await fileExists(path.join(skillsDir, 'user-notes.md'))).toBe(true);
  });

  it('uninstall removes only zama-* skill folders + marker (round trip; foreign skills untouched)', async () => {
    // Pre-populate a foreign skill folder so we can verify it survives uninstall.
    const skillsDir = path.join(tmp, '.claude', 'skills');
    await mkdir(path.join(skillsDir, 'other-plugin'), { recursive: true });
    await writeFile(path.join(skillsDir, 'other-plugin', 'SKILL.md'), 'foreign\n', 'utf8');

    const r = await installSkills({
      scope: 'project', projectRoot: tmp, homeRoot: tmp,
      sourceRoot: realSourceRoot, genericRoot: realGenericRoot,
      targets: ['claude-code'], force: true,
    });
    expect(await fileExists(path.join(r.installed[0]!.destDir, 'zama-init', 'SKILL.md'))).toBe(true);
    expect(await fileExists(path.join(r.installed[0]!.destDir, '.zama-skills-installed'))).toBe(true);

    await uninstallSkills({ projectRoot: tmp, homeRoot: tmp, targets: ['claude-code'] });

    // Our skills + marker gone.
    expect(await fileExists(path.join(r.installed[0]!.destDir, 'zama-init'))).toBe(false);
    expect(await fileExists(path.join(r.installed[0]!.destDir, '.zama-skills-installed'))).toBe(false);
    // Foreign skill survives.
    expect(await fileExists(path.join(skillsDir, 'other-plugin', 'SKILL.md'))).toBe(true);
  });
});

describe('entry-pointer hardening', () => {
  it('appendEntryPointer throws on a file with two BEGIN markers', async () => {
    const agents = path.join(tmp, 'AGENTS.md');
    await writeFile(
      agents,
      '# AI agent rules\n\n<!-- BEGIN zama-skills install pointer -->\nold A\n<!-- END zama-skills install pointer -->\n\n<!-- BEGIN zama-skills install pointer -->\nold B\n<!-- END zama-skills install pointer -->\n',
      'utf8',
    );
    await expect(
      installSkills({
        scope: 'project', projectRoot: tmp, homeRoot: tmp,
        sourceRoot: realSourceRoot, genericRoot: realGenericRoot,
        targets: ['opencode'], force: true,
      }),
    ).rejects.toThrow(/malformed zama-skills pointer/);
  });

  it('uninstall stripEntryPointer throws on duplicated BEGIN markers', async () => {
    // First do a clean install.
    await installSkills({
      scope: 'project', projectRoot: tmp, homeRoot: tmp,
      sourceRoot: realSourceRoot, genericRoot: realGenericRoot,
      targets: ['opencode'], force: true,
    });
    // Now corrupt AGENTS.md with a duplicate marker block.
    const agents = path.join(tmp, 'AGENTS.md');
    const content = await readFile(agents, 'utf8');
    await writeFile(agents, content + '\n<!-- BEGIN zama-skills install pointer -->\ndupe\n<!-- END zama-skills install pointer -->\n', 'utf8');
    await expect(
      uninstallSkills({ projectRoot: tmp, homeRoot: tmp, targets: ['opencode'] }),
    ).rejects.toThrow(/malformed zama-skills pointer/);
  });
});

describe('symlink rejection in source tree', () => {
  it('skips symlinks when copying a generic source', async () => {
    // Build a fake genericRoot containing a real .md and a symlinked .md → /etc/passwd
    const fakeGeneric = path.join(tmp, 'fake-generic');
    await mkdir(fakeGeneric, { recursive: true });
    await writeFile(path.join(fakeGeneric, 'init.md'), '# real\n', 'utf8');
    try {
      await symlink('/etc/passwd', path.join(fakeGeneric, 'evil.md'));
    } catch {
      // symlink not supported on this fs (e.g. Windows without admin) — skip silently.
      return;
    }
    const r = await installSkills({
      scope: 'project', projectRoot: tmp, homeRoot: tmp,
      sourceRoot: realSourceRoot, genericRoot: fakeGeneric,
      targets: ['cursor'], force: true,
    });
    const dest = r.installed[0]!.destDir;
    expect(await fileExists(path.join(dest, 'init.md'))).toBe(true);
    // Symlink must NOT have been copied.
    expect(await fileExists(path.join(dest, 'evil.md'))).toBe(false);
  });
});

describe('installSkills — input validation', () => {
  it('throws when no targets selected', async () => {
    await expect(
      installSkills({
        scope: 'project', projectRoot: tmp, homeRoot: tmp, sourceRoot: realSourceRoot, genericRoot: realGenericRoot,
        targets: [], force: true,
      }),
    ).rejects.toThrow(/No install targets/);
  });

  it('throws on unknown target id via findTarget', () => {
    expect(() => findTarget('bogus' as never)).toThrow(/Unknown install target/);
  });
});
