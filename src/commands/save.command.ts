import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { cancel, confirm, intro, isCancel, multiselect, outro, select, text } from '@clack/prompts';
import pc from 'picocolors';

import { DUMP_LUA } from '../lib/dump-lua.js';
import * as hs from '../lib/hammerspoon.js';
import { buildLayout } from '../lib/layout-builder.js';
import { DEFAULT_LAYOUTS_DIR, expandHome, loadLayout } from '../lib/layout-loader.js';
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

function dockIsOnScreen(s: RuntimeScreen): boolean {
  // Dock shrinks frame relative to fullFrame on whichever side it sits
  return (
    s.fullFrame.y + s.fullFrame.h > s.frame.y + s.frame.h + 5 // bottom
    || s.frame.x > s.fullFrame.x + 5 // left
    || s.fullFrame.x + s.fullFrame.w > s.frame.x + s.frame.w + 5 // right
  );
}

// ─── Helpers (hotkey) ─────────────────────────────────────────────────────────

const MOD_SET = new Set(['cmd', 'ctrl', 'shift', 'alt']);
const MOD_ALIASES: Record<string, string> = { opt: 'alt', option: 'alt', command: 'cmd' };

function parseHotkey(input: string): { mods: string[]; key: string } | null {
  const parts = input
    .toLowerCase()
    .trim()
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);
  const mods: string[] = [];
  let key: string | undefined;
  for (const part of parts) {
    const normalized = MOD_ALIASES[part] ?? part;
    if (MOD_SET.has(normalized)) {
      if (!mods.includes(normalized)) mods.push(normalized);
    } else {
      key = part;
    }
  }
  if (!key || mods.length === 0) return null;
  return { mods, key };
}

function formatHotkey(hotkey: { mods: readonly string[]; key: string }): string {
  return [...hotkey.mods, hotkey.key].join('+');
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

  // Load existing layout early — used for hotkey default in prompt and dock mismatch warning
  const existingLayoutResult = await loadLayout(name, options.layoutsDir);
  const existingLayout = existingLayoutResult.ok ? existingLayoutResult.layout : undefined;

  let displayRoleAssignments: Record<string, RuntimeScreen>;
  let selectedWindows: readonly RuntimeWindow[];
  let hotkeyResult: { mods: string[]; key: string } | undefined;

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

    // 4e. Hotkey trigger
    const existingHotkey = existingLayout?.options?.hotkey;
    const hotkeyRaw = await text({
      message: 'Hotkey trigger — leave blank to skip',
      placeholder: 'e.g. ctrl+shift+pad0',
      ...(existingHotkey !== undefined ? { initialValue: formatHotkey(existingHotkey) } : {}),
    });
    if (!isCancel(hotkeyRaw) && hotkeyRaw.trim()) {
      const parsed = parseHotkey(hotkeyRaw.trim());
      if (parsed) {
        hotkeyResult = parsed;
      } else {
        console.warn(`  ${pc.yellow('⚠')}  Could not parse hotkey — skipping`);
      }
    }
  }

  // 6. Build layout
  const baseLayout = buildLayout({ name, dump, selectedWindows, displayRoleAssignments });

  // 6b. Merge options — carry over existing options (preserves dockDisplay etc.) and apply hotkey
  const existingOpts = existingLayout?.options ?? {};
  const mergedOpts = {
    ...existingOpts,
    ...(hotkeyResult !== undefined ? { hotkey: hotkeyResult } : {}),
  };
  const layout = Object.keys(mergedOpts).length > 0
    ? { ...baseLayout, options: mergedOpts }
    : baseLayout;

  // 6c. Dock mismatch check — warn if dockDisplay doesn't match current Dock position
  if (!options.json) {
    const dockDisplayRole = existingLayout?.options?.dockDisplay;
    if (dockDisplayRole) {
      const currentDockScreen = dump.screens.find(dockIsOnScreen);
      const targetScreen = displayRoleAssignments[dockDisplayRole];
      if (currentDockScreen && targetScreen && currentDockScreen.id !== targetScreen.id) {
        const currentRole = Object.entries(displayRoleAssignments).find(
          ([, s]) => s.id === currentDockScreen.id,
        )?.[0] ?? currentDockScreen.name;
        console.warn(
          `\n  ${pc.yellow('⚠')} Dock is on ${pc.bold(currentRole)}, but this layout uses`
            + ` ${pc.bold(`dockDisplay: "${dockDisplayRole}"`)}.`
            + `\n    Move the Dock to ${
              pc.bold(dockDisplayRole)
            } before saving to avoid a 48px gap on apply.\n`,
        );
      }
    }
  }

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

  if (interactive && hotkeyResult) {
    await compileCommand({ name, options: { layoutsDir: options.layoutsDir } });
  }

  return EXIT_CODE.Success;
}
