#!/usr/bin/env node

import { applyCommand } from './commands/apply.command.js';
import { doctorCommand } from './commands/doctor.command.js';
import { dumpCommand } from './commands/dump.command.js';
import { listCommand } from './commands/list.command.js';
import { saveCommand } from './commands/save.command.js';
import { printHelp } from './macos-layouts.help.js';
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
      console.error('Error: layout name is required. Usage: macos-layouts apply <name>');
      process.exit(1);
      return;
    }
    const timeoutIdx = applyRest.indexOf('--timeout-ms');
    const timeoutArg = timeoutIdx !== -1 ? applyRest[timeoutIdx + 1] : undefined;
    const layoutsDirIdx = applyRest.indexOf('--layouts-dir');
    const layoutsDirArg = layoutsDirIdx !== -1 ? applyRest[layoutsDirIdx + 1] : undefined;
    const focusIdx = applyRest.indexOf('--focus');
    const focusArg = focusIdx !== -1 ? applyRest[focusIdx + 1] : undefined;
    const options: ApplyOptions = {
      dryRun: hasFlag(applyRest, '--dry-run'),
      strict: hasFlag(applyRest, '--strict'),
      json: hasFlag(applyRest, '--json'),
      verbose: hasFlag(applyRest, '--verbose'),
      timeoutMs: timeoutArg ? parseInt(timeoutArg, 10) : undefined,
      layoutsDir: layoutsDirArg ?? undefined,
      focus: focusArg ?? undefined,
    };
    const code = await applyCommand({ name: layoutName, options });
    process.exit(code);
    return;
  }

  if (command === 'save') {
    const [layoutName, ...saveRest] = rest;
    if (!layoutName) {
      console.error('Error: layout name is required. Usage: macos-layouts save <name>');
      process.exit(1);
      return;
    }
    const layoutsDirIdx = saveRest.indexOf('--layouts-dir');
    const layoutsDirArg = layoutsDirIdx !== -1 ? saveRest[layoutsDirIdx + 1] : undefined;
    // Collect repeated --include / --exclude values
    const include: string[] = [];
    const exclude: string[] = [];
    for (let i = 0; i < saveRest.length; i++) {
      if (saveRest[i] === '--include' && saveRest[i + 1]) include.push(saveRest[++i]!);
      if (saveRest[i] === '--exclude' && saveRest[i + 1]) exclude.push(saveRest[++i]!);
    }
    const options: SaveOptions = {
      layoutsDir: layoutsDirArg,
      interactive: hasFlag(saveRest, '--no-interactive') ? false : undefined,
      json: hasFlag(saveRest, '--json'),
      verbose: hasFlag(saveRest, '--verbose'),
      include: include.length > 0 ? include : undefined,
      exclude: exclude.length > 0 ? exclude : undefined,
    };
    const code = await saveCommand({ name: layoutName, options });
    process.exit(code);
    return;
  }

  if (command === 'list') {
    const layoutsDirIdx = rest.indexOf('--layouts-dir');
    const layoutsDirArg = layoutsDirIdx !== -1 ? rest[layoutsDirIdx + 1] : undefined;
    const options: ListOptions = {
      json: hasFlag(rest, '--json'),
      layoutsDir: layoutsDirArg,
    };
    const code = await listCommand({ options });
    process.exit(code);
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

  if (command === 'doctor') {
    const layoutsDirIdx = rest.indexOf('--layouts-dir');
    const layoutsDirArg = layoutsDirIdx !== -1 ? rest[layoutsDirIdx + 1] : undefined;
    const options: DoctorOptions = {
      json: hasFlag(rest, '--json'),
      fix: hasFlag(rest, '--fix'),
      verbose: hasFlag(rest, '--verbose'),
      layoutsDir: layoutsDirArg,
    };
    const code = await doctorCommand({ options });
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
