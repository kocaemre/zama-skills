import { Command } from 'commander';
import pc from 'picocolors';
import prompts from 'prompts';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { installSkills, uninstallSkills, destinationHasExisting, type InstallScope } from './install.js';
import { TARGETS, detectTargets, findTarget, type TargetId } from './targets.js';

const program = new Command();

program
  .name('zama-skills')
  .description('Install zama-skills (10 skills for confidential dApps on Zama Protocol fhEVM) into your AI agent of choice')
  .version('0.1.0');

program
  .command('install')
  .description('Copy zama-skills into one or more AI agent rule directories')
  .option('--scope <scope>', 'personal | project — only affects targets that support a global rules dir (claude-code, generic). Default: ask if claude-code is selected, else project.')
  .option(
    '--tool <tool>',
    'comma-separated list: claude-code,cursor,windsurf,opencode,aider,continue,codex,generic. Skips the interactive picker.',
  )
  .option('--all', 'install for every supported tool (non-interactive)', false)
  .option('--force', 'overwrite existing rules without prompting', false)
  .action(async (opts: { scope?: string; tool?: string; all: boolean; force: boolean }) => {
    const scopeFlagProvided = typeof opts.scope === 'string';
    let scope = (opts.scope === 'personal' ? 'personal' : 'project') as InstallScope;

    const here = path.dirname(fileURLToPath(import.meta.url));
    const sourceRoot = path.resolve(here, '..', '..', 'plugins', 'zama-skills', 'skills');
    const genericRoot = path.resolve(here, '..', '..', 'generic');

    const projectRoot = process.cwd();
    const homeRoot = os.homedir();

    // Resolve which targets to install for.
    let targets: TargetId[];

    if (opts.all) {
      targets = TARGETS.map((t) => t.id);
    } else if (opts.tool) {
      const raw = opts.tool.split(',').map((s) => s.trim()).filter(Boolean);
      // Defense-in-depth: charset-validate before whitelist lookup, so future refactors
      // that interpolate the id into a path can't be exploited.
      for (const id of raw) {
        if (!/^[a-z][a-z0-9-]{0,31}$/.test(id)) {
          console.error(pc.red(`invalid --tool value: ${JSON.stringify(id)} (expected lowercase kebab-case, ≤32 chars)`));
          process.exit(1);
        }
      }
      const ids = raw as TargetId[];
      for (const id of ids) findTarget(id);
      targets = ids;
    } else {
      // Interactive picker — detect against cwd (the only place project-local tools care about).
      const detected = await detectTargets(projectRoot);
      const choices = TARGETS.map((t) => {
        const detectedTag = detected.includes(t.id) ? pc.green(' (detected)') : '';
        return {
          title: t.label + detectedTag,
          description: t.description,
          value: t.id,
          selected: detected.includes(t.id) || t.id === 'claude-code',
        };
      });
      console.log('');
      console.log(pc.bold(pc.cyan('zama-skills installer')));
      console.log(pc.dim('Select every AI tool you want the skill rules installed for.'));
      console.log(pc.dim('Use SPACE to toggle, ENTER to confirm. Detected tools are pre-selected.'));
      console.log('');
      const answer = await prompts({
        type: 'multiselect',
        name: 'targets',
        message: 'Install for:',
        choices,
        instructions: false,
        hint: 'space to toggle · enter to confirm',
        min: 1,
      });
      if (!answer.targets || answer.targets.length === 0) {
        console.log(pc.yellow('No targets selected — nothing installed.'));
        process.exit(0);
      }
      targets = answer.targets as TargetId[];
    }

    // If Claude Code is among targets and the user did not pass --scope explicitly,
    // ask whether to install globally (~/.claude) or to this project (.claude).
    // Skip in non-interactive mode (--tool or --all) — default to project.
    const interactive = !opts.all && !opts.tool;
    if (interactive && !scopeFlagProvided && targets.includes('claude-code')) {
      const scopeAnswer = await prompts({
        type: 'select',
        name: 'scope',
        message: 'Claude Code: install where?',
        choices: [
          {
            title: 'Global  (~/.claude/skills) — available in every project',
            value: 'personal',
          },
          {
            title: 'Project (./.claude/skills) — only this directory',
            value: 'project',
          },
        ],
        initial: 0,
      });
      if (!scopeAnswer.scope) {
        console.log(pc.yellow('No scope chosen — aborted.'));
        process.exit(0);
      }
      scope = scopeAnswer.scope as InstallScope;
    }

    // Build the set of targets that should land under $HOME.
    // Only targets with supportsGlobalScope=true honor 'personal' scope; everything else stays project-local.
    const globalTargets = new Set<TargetId>();
    if (scope === 'personal') {
      for (const id of targets) {
        if (findTarget(id).supportsGlobalScope) globalTargets.add(id);
      }
      const projectOnly = targets
        .map((id) => findTarget(id))
        .filter((t) => !t.supportsGlobalScope);
      if (projectOnly.length > 0) {
        console.log('');
        console.log(pc.dim(`Note: ${projectOnly.map((t) => t.label).join(', ')} only support project-local rules — installing those under cwd.`));
      }
    }

    let force = opts.force;
    if (!force && (await destinationHasExisting(projectRoot, homeRoot, targets, globalTargets))) {
      const answer = await prompts({
        type: 'confirm',
        name: 'ok',
        message: `Existing rules found at one or more target dirs. Overwrite?`,
        initial: false,
      });
      if (!answer.ok) {
        console.log(pc.yellow('Aborted — no files written.'));
        process.exit(0);
      }
      force = true;
    }

    try {
      const result = await installSkills({
        scope,
        projectRoot,
        homeRoot,
        globalTargets,
        sourceRoot,
        genericRoot,
        targets,
        force,
      });
      console.log('');
      console.log(pc.bold(pc.green(`✓ zama-skills installed for ${result.installed.length} target(s)`)));
      console.log('');
      for (const it of result.installed) {
        const t = findTarget(it.target);
        console.log(`  ${pc.bold(pc.cyan(t.label))}`);
        console.log(`    ${pc.dim('dest:')}    ${it.destDir}`);
        console.log(`    ${pc.dim('written:')} ${it.written} file(s)`);
        if (it.entryPointAppended) {
          console.log(`    ${pc.dim('entry:')}   ${it.entryPointAppended} (pointer block appended)`);
        }
        const root = t.supportsGlobalScope && globalTargets.has(t.id) ? homeRoot : projectRoot;
        console.log(`    ${pc.dim('hint:')}    ${t.postInstallHint(root)}`);
        console.log('');
      }
      console.log(pc.bold('Pipeline order:'));
      console.log(`  ${pc.cyan('design → init → contract → test → audit → deploy → frontend')}`);
      console.log('');
      console.log(pc.dim('Catalogue: https://github.com/kocaemre/zama-skills#what-you-get'));
    } catch (err) {
      console.error(pc.red('install failed:'), (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('uninstall')
  .description('Remove zama-skills from one or more AI agent rule directories')
  .option('--scope <scope>', 'personal | project — which copy to remove for global-capable targets (claude-code, generic). Default: ask if claude-code is selected, else project.')
  .option(
    '--tool <tool>',
    'comma-separated list: claude-code,cursor,windsurf,opencode,aider,continue,codex,generic. Skips the interactive picker.',
  )
  .option('--all', 'uninstall from every supported tool (non-interactive)', false)
  .option('--force', 'skip the confirmation prompt', false)
  .action(async (opts: { scope?: string; tool?: string; all: boolean; force: boolean }) => {
    const scopeFlagProvided = typeof opts.scope === 'string';
    let scope = (opts.scope === 'personal' ? 'personal' : 'project') as InstallScope;

    const projectRoot = process.cwd();
    const homeRoot = os.homedir();

    // Build a list of "where do we already see zama-skills installed?" — used to pre-select
    // the picker AND to reject obviously-empty uninstall calls.
    async function detectInstalled(root: string): Promise<TargetId[]> {
      const found: TargetId[] = [];
      for (const t of TARGETS) {
        const dest = t.destDir(root);
        // eslint-disable-next-line no-await-in-loop
        if (await (await import('fs-extra')).default.pathExists(dest)) found.push(t.id);
      }
      return found;
    }

    let targets: TargetId[];
    if (opts.all) {
      targets = TARGETS.map((t) => t.id);
    } else if (opts.tool) {
      const ids = opts.tool.split(',').map((s) => s.trim()).filter(Boolean) as TargetId[];
      for (const id of ids) findTarget(id);
      targets = ids;
    } else {
      const projectInstalled = await detectInstalled(projectRoot);
      const homeInstalled = await detectInstalled(homeRoot);
      const seen = new Set<TargetId>([...projectInstalled, ...homeInstalled]);
      const choices = TARGETS.map((t) => {
        const tag = seen.has(t.id) ? pc.green(' (installed)') : '';
        return {
          title: t.label + tag,
          description: t.description,
          value: t.id,
          selected: seen.has(t.id),
        };
      });
      console.log('');
      console.log(pc.bold(pc.cyan('zama-skills uninstaller')));
      console.log(pc.dim('Select the AI tools to remove the rules from. Detected installs are pre-selected.'));
      console.log('');
      const answer = await prompts({
        type: 'multiselect',
        name: 'targets',
        message: 'Uninstall from:',
        choices,
        instructions: false,
        hint: 'space to toggle · enter to confirm',
        min: 1,
      });
      if (!answer.targets || answer.targets.length === 0) {
        console.log(pc.yellow('No targets selected — nothing removed.'));
        process.exit(0);
      }
      targets = answer.targets as TargetId[];
    }

    const interactiveU = !opts.all && !opts.tool;
    if (interactiveU && !scopeFlagProvided && targets.includes('claude-code')) {
      const scopeAnswer = await prompts({
        type: 'select',
        name: 'scope',
        message: 'Claude Code: remove which install?',
        choices: [
          { title: 'Global  (~/.claude/skills/zama-skills)', value: 'personal' },
          { title: 'Project (./.claude/skills/zama-skills)', value: 'project' },
        ],
        initial: 0,
      });
      if (!scopeAnswer.scope) {
        console.log(pc.yellow('No scope chosen — aborted.'));
        process.exit(0);
      }
      scope = scopeAnswer.scope as InstallScope;
    }

    const globalTargets = new Set<TargetId>();
    if (scope === 'personal') {
      for (const id of targets) {
        if (findTarget(id).supportsGlobalScope) globalTargets.add(id);
      }
    }

    // Show what will be removed and confirm.
    console.log('');
    console.log(pc.bold('The following will be removed:'));
    for (const id of targets) {
      const t = findTarget(id);
      const root = t.supportsGlobalScope && globalTargets.has(id) ? homeRoot : projectRoot;
      console.log(`  ${pc.cyan(t.label)} → ${pc.dim(t.destDir(root))}`);
      if (t.entryPoint) {
        console.log(`    ${pc.dim('+ pointer block in:')} ${pc.dim(t.entryPoint(root))}`);
      }
    }
    console.log('');

    if (!opts.force) {
      const ok = await prompts({
        type: 'confirm',
        name: 'ok',
        message: 'Proceed with removal?',
        initial: false,
      });
      if (!ok.ok) {
        console.log(pc.yellow('Aborted — nothing removed.'));
        process.exit(0);
      }
    }

    try {
      const result = await uninstallSkills({ projectRoot, homeRoot, globalTargets, targets });
      console.log('');
      console.log(pc.bold(pc.green(`✓ zama-skills uninstalled for ${result.uninstalled.length} target(s)`)));
      console.log('');
      for (const it of result.uninstalled) {
        const t = findTarget(it.target);
        const status = it.removed ? pc.green('removed') : pc.yellow('not found');
        console.log(`  ${pc.bold(pc.cyan(t.label))}  [${status}]`);
        console.log(`    ${pc.dim('dest:')}    ${it.destDir}`);
        if (it.entryPointStripped) {
          console.log(`    ${pc.dim('entry:')}   ${it.entryPointStripped} (pointer block stripped)`);
        }
        console.log('');
      }
    } catch (err) {
      console.error(pc.red('uninstall failed:'), (err as Error).message);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(pc.red('zama-skills error:'), err);
  process.exit(1);
});

export { program };
