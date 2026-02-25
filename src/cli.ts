#!/usr/bin/env node

import { applyCommand } from './commands/apply.command.js';
import { doctorCommand } from './commands/doctor.command.js';
import { dumpCommand } from './commands/dump.command.js';
import { listCommand } from './commands/list.command.js';
import { saveCommand } from './commands/save.command.js';
import { printHelp } from './layouts.help.js';
import type {
  ApplyOptions,
  DoctorOptions,
  DumpOptions,
  ListOptions,
  SaveOptions,
} from './types/cli.types.js';

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

  if (command === 'apply') {
    const [layoutName, ...applyRest] = rest;
    if (!layoutName) {
      console.error('Error: layout name is required. Usage: layouts apply <name>');
      process.exit(1);
    }
    const focusIdx = applyRest.indexOf('--focus');
    const focusArg = focusIdx !== -1 ? applyRest[focusIdx + 1] : undefined;
    const options: ApplyOptions = {
      dryRun: hasFlag(applyRest, '--dry-run'),
      focus: focusArg ?? undefined,
    };
    const code = await applyCommand({ name: layoutName, options });
    process.exit(code);
  }

  if (command === 'save') {
    const [layoutName, ...saveRest] = rest;
    if (!layoutName) {
      console.error('Error: layout name is required. Usage: layouts save <name>');
      process.exit(1);
    }
    // Collect repeated --include / --exclude values
    const include: string[] = [];
    const exclude: string[] = [];
    for (let i = 0; i < saveRest.length; i++) {
      if (saveRest[i] === '--include' && saveRest[i + 1]) include.push(saveRest[++i]!);
      if (saveRest[i] === '--exclude' && saveRest[i + 1]) exclude.push(saveRest[++i]!);
    }
    const options: SaveOptions = {
      include: include.length > 0 ? include : undefined,
      exclude: exclude.length > 0 ? exclude : undefined,
    };
    const code = await saveCommand({ name: layoutName, options });
    process.exit(code);
  }

  if (command === 'list') {
    const options: ListOptions = {};
    const code = await listCommand({ options });
    process.exit(code);
  }

  if (command === 'dump') {
    const options: DumpOptions = {
      json: hasFlag(rest, '--json'),
      pretty: hasFlag(rest, '--pretty'),
      includeMinimized: hasFlag(rest, '--include-minimized'),
    };
    const code = await dumpCommand({ options });
    process.exit(code);
  }

  if (command === 'doctor') {
    const options: DoctorOptions = {
      fix: hasFlag(rest, '--fix'),
    };
    const code = await doctorCommand({ options });
    process.exit(code);
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
