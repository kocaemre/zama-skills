import { Command } from 'commander';
import pc from 'picocolors';
import prompts from 'prompts';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { installSkills, destinationHasExisting, type InstallScope } from './install.js';

const program = new Command();

program
  .name('zama-skills')
  .description('Install zama-skills plugin into Claude Code')
  .version('0.1.0');

program
  .command('install')
  .description('Copy zama-skills bundles into Claude Code skills directory')
  .option('--scope <scope>', 'personal | project', 'personal')
  .option('--force', 'overwrite existing skills without prompting', false)
  .action(async (opts: { scope: string; force: boolean }) => {
    const scope = (opts.scope === 'project' ? 'project' : 'personal') as InstallScope;
    const targetRoot = scope === 'project' ? process.cwd() : os.homedir();

    // Resolve bundled skills relative to this file (works whether installed or run from repo).
    const here = path.dirname(fileURLToPath(import.meta.url));
    const sourceRoot = path.resolve(here, '..', '..', 'plugins', 'zama-skills', 'skills');

    let force = opts.force;
    if (!force && (await destinationHasExisting(targetRoot))) {
      const answer = await prompts({
        type: 'confirm',
        name: 'ok',
        message: `Existing skills found at ${path.join(targetRoot, '.claude/skills/zama-skills')}. Overwrite?`,
        initial: false,
      });
      if (!answer.ok) {
        console.log(pc.yellow('Aborted — no files written.'));
        process.exit(0);
      }
      force = true;
    }

    try {
      const result = await installSkills({ scope, targetRoot, sourceRoot, force });
      console.log(pc.bold(pc.green('zama-skills installed!')));
      console.log('');
      console.log(`  ${pc.dim('scope:')}   ${pc.cyan(result.scope)}`);
      console.log(`  ${pc.dim('target:')}  ${pc.cyan(result.target)}`);
      console.log(`  ${pc.dim('written:')} ${pc.cyan(String(result.written))} skill bundle(s)`);
      console.log('');
      console.log(pc.bold('Next steps:'));
      console.log(`  1. Open Claude Code in your project.`);
      console.log(`  2. Run ${pc.green('/zama-skills:init')} to scaffold your first confidential dApp.`);
      console.log(`  3. Read ${pc.cyan('https://github.com/kocaemre/zama-skills#readme')} for the full skill catalogue.`);
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
