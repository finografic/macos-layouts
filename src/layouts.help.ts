import pc from 'picocolors';

import {
  columnMax,
  type HelpCommand,
  type HelpExample,
  renderCommand,
  renderExample,
  renderUsage,
} from './utils/help.utils.js';

export function printHelp(): void {
  const lines: string[] = [];

  lines.push('');
  lines.push(`${pc.bold('layouts')} - Trigger perfect window layouts in macOS`);
  lines.push('');

  lines.push(pc.bold('USAGE'));
  lines.push(`  ${renderUsage('layouts', '<command>', '[options]')}`);
  lines.push('');

  lines.push(pc.bold('COMMANDS'));
  const commands: HelpCommand[] = [
    { cmd: 'apply', desc: 'Apply a saved layout to current windows' },
    { cmd: 'save', desc: 'Save current window positions as a new layout' },
    { cmd: 'list', desc: 'List available layouts' },
    { cmd: 'dump', desc: 'Print current screen and window state from Hammerspoon' },
    { cmd: 'doctor', desc: 'Check environment (Hammerspoon, permissions, layouts directory)' },
  ];
  const cmdWidth = columnMax(commands, (c) => c.cmd);
  for (const command of commands) lines.push(renderCommand(command, cmdWidth));
  lines.push('');

  lines.push(pc.bold('OPTIONS'));
  lines.push('  -h, --help       Show help for a command');
  lines.push('  -v, --version    Show version number');
  lines.push('');

  lines.push(pc.bold('EXAMPLES'));
  const examples: HelpExample[] = [
    { cmd: 'layouts apply work', comment: 'Apply the "work" layout' },
    { cmd: 'layouts apply home --dry-run', comment: 'Preview what would move' },
    { cmd: 'layouts save work', comment: 'Save current windows as "work" layout (interactive)' },
    { cmd: 'layouts list', comment: 'List available layouts' },
    { cmd: 'layouts dump', comment: 'Show current screens and windows (human-readable)' },
    { cmd: 'layouts dump --json --pretty', comment: 'Pretty-print full JSON snapshot' },
    {
      cmd: 'layouts dump --json --pretty --include-minimized',
      comment: 'Include minimized windows',
    },
    { cmd: 'layouts doctor', comment: 'Check environment' },
    { cmd: 'layouts doctor --fix', comment: 'Show fix instructions for failed checks' },
  ];
  const exampleWidth = columnMax(examples, (e) => e.cmd);
  for (const example of examples) lines.push(renderExample(example, exampleWidth));
  lines.push('');

  lines.push(pc.bold('GET HELP'));
  lines.push(
    `  ${renderUsage('layouts', '<command>', '--help')}       ${
      pc.dim('# Show detailed help for a command')
    }`,
  );
  lines.push('');

  console.log(lines.join('\n'));
}
