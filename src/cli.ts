#!/usr/bin/env node

import { dumpCommand } from './commands/dump.command.js';
import { printHelp } from './macos-layouts.help.js';
import type { DumpOptions } from './types/cli.types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasFlag(list: readonly string[], ...flags: string[]): boolean {
  return flags.some((f) => list.includes(f));
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const [command, ...rest] = args;

async function main(): Promise<void> {
  if (!command || hasFlag(args, '--help', '-h')) {
    printHelp();
    return;
  }

  if (command === 'dump') {
    const options: DumpOptions = {
      json: hasFlag(rest, '--json'),
      pretty: hasFlag(rest, '--pretty'),
      includeMinimized: hasFlag(rest, '--include-minimized'),
      includeHidden: hasFlag(rest, '--include-hidden'),
      verbose: hasFlag(rest, '--verbose'),
    };
    const code = await dumpCommand({ options });
    process.exit(code);
    return;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
