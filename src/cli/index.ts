import { Command } from 'commander';
import pc from 'picocolors';
import prompts from 'prompts';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { installSkills, destinationHasExisting, type InstallScope } from './install.js';
import { TARGETS, detectTargets, findTarget, type TargetId } from './targets.js';

const program = new Command();

program
  .name('zama-skills')
  .description('Install zama-skills (10 skills for confidential dApps on Zama Protocol fhEVM) into your AI agent of choice')
  .version('0.1.0');

program
  .command('install')
  .description('Copy zama-skills into one or more AI agent rule directories')
  .option('--scope <scope>', 'personal | project (project = cwd, personal = $HOME)', 'project')
  .option(
    '--tool <tool>',
    'comma-separated list: claude-code,cursor,opencode,aider,continue,codex,generic. Skips the interactive picker.',
  )
  .option('--all', 'install for every supported tool (non-interactive)', false)
  .option('--force', 'overwrite existing rules without prompting', false)
  .action(async (opts: { scope: string; tool?: string; all: boolean; force: boolean }) => {
    const scope = (opts.scope === 'personal' ? 'personal' : 'project') as InstallScope;
    const targetRoot = scope === 'project' ? process.cwd() : os.homedir();

    const here = path.dirname(fileURLToPath(import.meta.url));
    const sourceRoot = path.resolve(here, '..', '..', 'plugins', 'zama-skills', 'skills');
    const genericRoot = path.resolve(here, '..', '..', 'generic');

    // Resolve which targets to install for.
    let targets: TargetId[];
    if (opts.all) {
      targets = TARGETS.map((t) => t.id);
    } else if (opts.tool) {
      const ids = opts.tool.split(',').map((s) => s.trim()).filter(Boolean) as TargetId[];
      // Validate every id.
      for (const id of ids) findTarget(id);
      targets = ids;
    } else {
      // Interactive picker.
      const detected = await detectTargets(targetRoot);
      const choices = TARGETS.map((t) => ({
        title: t.label + (detected.includes(t.id) ? pc.green(' (detected)') : ''),
        description: t.description,
        value: t.id,
        selected: detected.includes(t.id) || t.id === 'claude-code', // default Claude Code on
      }));
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

    let force = opts.force;
    if (!force && (await destinationHasExisting(targetRoot, targets))) {
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
        targetRoot,
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
        console.log(`    ${pc.dim('hint:')}    ${t.postInstallHint(targetRoot)}`);
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

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(pc.red('zama-skills error:'), err);
  process.exit(1);
});

export { program };
