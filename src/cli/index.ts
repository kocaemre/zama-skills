import { Command } from 'commander';
import pc from 'picocolors';

const program = new Command();

program
  .name('zama-skills')
  .description('Install zama-skills plugin into Claude Code')
  .version('0.0.0-dev');

program
  .command('install')
  .description('Install the zama-skills plugin (Phase 1: prints recommended /plugin commands)')
  .option('--scope <scope>', 'personal | project', 'personal')
  .action((opts: { scope: string }) => {
    console.log(pc.bold(pc.cyan('zama-skills installer (Phase 1 stub)')));
    console.log('');
    console.log(pc.yellow('Recommended path — install as a Claude Code plugin:'));
    console.log('  ' + pc.green('/plugin marketplace add https://github.com/<owner>/zama-skills'));
    console.log('  ' + pc.green('/plugin install zama-skills@zama-skills'));
    console.log('');
    console.log(pc.dim(`Requested scope: ${opts.scope}`));
    console.log(pc.dim('Direct file copy to ~/.claude/skills/ ships in Phase 6 (PLUGIN-05).'));
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(pc.red('zama-skills error:'), err);
  process.exit(1);
});

export { program };
