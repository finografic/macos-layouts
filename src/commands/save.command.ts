import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { cancel, confirm, intro, isCancel, multiselect, outro, select } from '@clack/prompts';
import pc from 'picocolors';

import { DUMP_LUA } from '../lib/dump-lua.js';
import * as hs from '../lib/hammerspoon.js';
import { buildLayout } from '../lib/layout-builder.js';
import { DEFAULT_LAYOUTS_DIR, expandHome } from '../lib/layout-loader.js';
import type { SaveOptions } from '../types/cli.types.js';
import { EXIT_CODE } from '../types/cli.types.js';
import type { RuntimeScreen, RuntimeWindow } from '../types/runtime.types.js';
import { compileCommand } from './compile.command.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SaveCommandParams {
  readonly name: string;
  readonly options: SaveOptions;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_TITLE_LENGTH = 50;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function autoAssignRoles(screens: readonly RuntimeScreen[]): Record<string, RuntimeScreen> {
  const roles: Record<string, RuntimeScreen> = {};
  const remaining = [...screens];

  const primary = remaining.find((s) => s.isPrimary);
  if (primary) {
    roles['primary'] = primary;
    remaining.splice(remaining.indexOf(primary), 1);
  }

  const builtin = remaining.find((s) => s.isBuiltin);
  if (builtin) {
    roles['builtin'] = builtin;
    remaining.splice(remaining.indexOf(builtin), 1);
  }

  const roleNames = ['secondary', 'tertiary', 'quaternary'];
  const sorted = [...remaining].sort(
    (a, b) => b.fullFrame.w * b.fullFrame.h - a.fullFrame.w * a.fullFrame.h,
  );
  for (let i = 0; i < sorted.length; i++) {
    roles[roleNames[i] ?? `display-${i}`] = sorted[i]!;
  }

  return roles;
}

// ─── Command ──────────────────────────────────────────────────────────────────

export async function saveCommand({ name, options }: SaveCommandParams): Promise<number> {
  // 1. Check HS availability
  const available = await hs.isAvailable();
  if (!available) {
    console.error(
      `${
        pc.red('Error:')
      } Hammerspoon is not available. Is \`hs\` on your PATH and Hammerspoon running?`,
    );
    return EXIT_CODE.RuntimeUnavailable;
  }

  // 2. Dump current state
  const dumpResult = await hs.dump({ lua: DUMP_LUA });
  if (!dumpResult.ok) {
    console.error(`${pc.red('Error:')} ${dumpResult.error.message}`);
    return EXIT_CODE.Error;
  }
  const dump = dumpResult.value;

  // 3. Filter windows
  let windows = dump.windows.filter((w) => w.isStandard && !w.isMinimized);

  if (options.include && options.include.length > 0) {
    const include = options.include;
    windows = windows.filter((w) =>
      include.some(
        (f) =>
          w.app.name.toLowerCase().includes(f.toLowerCase())
          || w.app.bundleId?.toLowerCase().includes(f.toLowerCase()),
      )
    );
  }

  if (options.exclude && options.exclude.length > 0) {
    const exclude = options.exclude;
    windows = windows.filter(
      (w) =>
        !exclude.some(
          (f) =>
            w.app.name.toLowerCase().includes(f.toLowerCase())
            || w.app.bundleId?.toLowerCase().includes(f.toLowerCase()),
        ),
    );
  }

  const interactive = options.interactive !== false && process.stdout.isTTY;

  let displayRoleAssignments: Record<string, RuntimeScreen>;
  let selectedWindows: readonly RuntimeWindow[];

  if (!interactive) {
    // Non-interactive: auto-assign roles, include all filtered windows
    displayRoleAssignments = autoAssignRoles(dump.screens);
    selectedWindows = windows;
  } else {
    // Interactive flow
    intro('Save layout');

    // 4a. Show screen summary
    console.log(pc.dim('\nDetected screens:'));
    for (const s of dump.screens) {
      const tags = [s.isPrimary ? 'primary' : null, s.isBuiltin ? 'built-in' : null]
        .filter(Boolean)
        .join(', ');
      console.log(
        `  ${pc.cyan(s.name)}  ${s.resolution.w}×${s.resolution.h}${
          tags ? pc.dim(` [${tags}]`) : ''
        }`,
      );
    }
    console.log('');

    // 4b. Display role assignment
    displayRoleAssignments = {};
    const defaultRoleNames = ['primary', 'secondary', 'tertiary', 'quaternary'];

    for (let i = 0; i < dump.screens.length; i++) {
      const screen = dump.screens[i]!;
      const defaultRole = screen.isPrimary
        ? 'primary'
        : screen.isBuiltin
        ? 'builtin'
        : defaultRoleNames[i] ?? `display-${i}`;

      const result = await select({
        message: `Role for "${screen.name}" (${screen.resolution.w}×${screen.resolution.h})?`,
        options: [
          { value: defaultRole, label: defaultRole },
          ...['primary', 'secondary', 'builtin', 'tertiary'].filter((r) => r !== defaultRole).map((
            r,
          ) => ({ value: r, label: r })),
          { value: '__skip__', label: 'skip (exclude from layout)' },
        ],
      });

      if (isCancel(result)) {
        cancel('Cancelled');
        return EXIT_CODE.Error;
      }

      if (result !== '__skip__') {
        displayRoleAssignments[result as string] = screen;
      }
    }

    // 4c. Window selection
    const windowOptions = windows.map((w) => {
      const screenName = dump.screens.find((s) => s.id === w.screenId)?.name ?? w.screenId;
      const title = truncate(w.title || '(no title)', MAX_TITLE_LENGTH);
      return {
        value: w.id,
        label: `${w.app.name} — ${title}`,
        hint: screenName,
      };
    });

    const selectedIds = await multiselect({
      message: 'Which windows should be included?',
      options: windowOptions,
      required: false,
    });

    if (isCancel(selectedIds)) {
      cancel('Cancelled');
      return EXIT_CODE.Error;
    }

    selectedWindows = windows.filter((w) => (selectedIds as string[]).includes(w.id));

    // 4d. Confirm
    const confirmed = await confirm({ message: `Save layout as "${name}"?` });
    if (isCancel(confirmed) || !confirmed) {
      cancel('Cancelled');
      return EXIT_CODE.Error;
    }
  }

  // 6. Build layout
  const layout = buildLayout({ name, dump, selectedWindows, displayRoleAssignments });

  // 7. Write to disk
  const dir = expandHome(options.layoutsDir ?? DEFAULT_LAYOUTS_DIR);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${name}.json`);
  await writeFile(filePath, JSON.stringify(layout, null, 2) + '\n');

  // 8. Print summary
  const roleCount = Object.keys(displayRoleAssignments).length;
  const appNames = [...new Set(selectedWindows.map((w) => w.app.name))].sort();

  if (interactive) {
    outro(`Layout saved`);
  }
  console.log('');
  console.log(`  ${pc.bold('Saved:')} ${pc.cyan(filePath)}`);
  console.log(`  Displays: ${roleCount} role(s) assigned`);
  console.log(`  Windows:  ${layout.windows.length} rule(s) created`);
  if (appNames.length > 0) {
    console.log(`  Apps:     ${appNames.join(', ')}`);
  }
  console.log('');

  if (options.json) {
    console.log(JSON.stringify(layout, null, 2));
  }

  if (interactive) {
    const shouldCompile = await confirm({ message: `Compile "${name}" for Hammerspoon hotkey?` });
    if (!isCancel(shouldCompile) && shouldCompile) {
      await compileCommand({ name, options: { layoutsDir: options.layoutsDir } });
    }
  }

  return EXIT_CODE.Success;
}
