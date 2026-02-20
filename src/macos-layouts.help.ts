import pc from 'picocolors';

export function printHelp(): void {
  const lines: string[] = [];

  lines.push('');
  lines.push(`${pc.bold('macos-layouts')} - Trigger perfect window layouts in macOS`);
  lines.push('');

  lines.push(pc.bold('USAGE'));
  lines.push(`  ${pc.cyanBright('macos-layouts')} ${pc.dim(pc.cyan('<command>'))} [options]`);
  lines.push('');

  lines.push(pc.bold('COMMANDS'));
  const commands = [
    { name: 'dump', desc: 'Print current screen and window state from Hammerspoon' },
  ];
  const maxNameLength = Math.max(...commands.map((c) => c.name.length));
  for (const cmd of commands) {
    lines.push(
      `  ${pc.cyan(cmd.name)}${' '.repeat(maxNameLength - cmd.name.length + 4)}${cmd.desc}`,
    );
  }
  lines.push('');

  lines.push(pc.bold('OPTIONS'));
  lines.push('  -h, --help       Show help for a command');
  lines.push('  -v, --version    Show version number');
  lines.push('');

  lines.push(pc.bold('EXAMPLES'));
  const examples = [
    { cmd: 'macos-layouts dump', comment: 'Show current screens and windows (human-readable)' },
    { cmd: 'macos-layouts dump --json --pretty', comment: 'Pretty-print full JSON snapshot' },
    {
      cmd: 'macos-layouts dump --json --pretty --include-minimized',
      comment: 'Include minimized windows',
    },
    {
      cmd: 'macos-layouts dump --include-hidden',
      comment: 'Include non-standard windows (panels, popovers)',
    },
  ];
  const maxCmdLength = Math.max(...examples.map((e) => e.cmd.length));
  for (const ex of examples) {
    lines.push(
      `  ${ex.cmd}${' '.repeat(maxCmdLength - ex.cmd.length + 4)}${pc.dim('# ' + ex.comment)}`,
    );
  }
  lines.push('');

  lines.push(pc.bold('GET HELP'));
  lines.push(
    `  ${pc.cyanBright('macos-layouts')} ${pc.dim(pc.cyan('<command>'))} --help       ${
      pc.dim('# Show detailed help for a command')
    }`,
  );
  lines.push('');

  console.log(lines.join('\n'));
}
