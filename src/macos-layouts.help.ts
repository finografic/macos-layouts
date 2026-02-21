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
    { name: 'apply', desc: 'Apply a saved layout to current windows' },
    { name: 'save', desc: 'Save current window positions as a new layout' },
    { name: 'list', desc: 'List available layouts' },
    { name: 'dump', desc: 'Print current screen and window state from Hammerspoon' },
    { name: 'doctor', desc: 'Check environment (Hammerspoon, permissions, layouts directory)' },
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
    { cmd: 'macos-layouts apply work', comment: 'Apply the "work" layout' },
    { cmd: 'macos-layouts apply home --dry-run', comment: 'Preview what would move' },
    { cmd: 'macos-layouts apply home --strict', comment: 'Fail if any required rule is skipped' },
    {
      cmd: 'macos-layouts save work',
      comment: 'Save current windows as "work" layout (interactive)',
    },
    { cmd: 'macos-layouts save home --no-interactive', comment: 'Save without prompts' },
    { cmd: 'macos-layouts list', comment: 'List available layouts' },
    { cmd: 'macos-layouts list --json', comment: 'List layout names as JSON array' },
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
    { cmd: 'macos-layouts doctor', comment: 'Check environment' },
    { cmd: 'macos-layouts doctor --fix', comment: 'Show fix instructions for failed checks' },
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
