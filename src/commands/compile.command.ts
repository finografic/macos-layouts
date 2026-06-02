import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pc from 'picocolors';

import { layoutBlockExists, upsertLayoutBlock } from 'lib/init-lua.js';
import type { HotkeyBinding } from 'lib/init-lua.js';
import { expandHome, loadLayout } from 'lib/layout-loader.js';
import { generateLua } from 'lib/lua-codegen.js';

import { DEFAULT_COMPILE_OUTPUT_DIR, INIT_LUA_PATH } from 'config/defaults.constants.js';
import type { CompileOptions } from 'types/cli.types.js';
import { EXIT_CODE } from 'types/cli.types.js';
import type { DisplayRoleMap } from 'types/display.types.js';
import type { Layout } from 'types/layout.types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Swap display role match definitions before compiling.
 *
 * - 3-role layout (has "secondary" + "tertiary"): swaps those two.
 * - 2-role layout (has "primary" + "secondary"): swaps those two.
 *
 * Only the `match` (and `fallback`) of each role is exchanged — window rules are unchanged. They still
 * reference the same role names; the names now resolve to different screens.
 */
function applyRoleSwap(layout: Layout): Layout {
  const roles = layout.displayRoles;

  let a: string | undefined;
  let b: string | undefined;

  if (roles['secondary'] !== undefined && roles['tertiary'] !== undefined) {
    a = 'secondary';
    b = 'tertiary';
  } else if (roles['primary'] !== undefined && roles['secondary'] !== undefined) {
    a = 'primary';
    b = 'secondary';
  }

  if (a === undefined || b === undefined) return layout;

  const newRoles: DisplayRoleMap = Object.fromEntries(
    Object.entries(roles).map(([k, v]) => {
      if (k === a) return [k, roles[b]];
      if (k === b) return [k, roles[a]];
      return [k, v];
    }),
  );

  return { ...layout, displayRoles: newRoles };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompileCommandParams {
  readonly name: string;
  readonly options: CompileOptions;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Ensures Dock animation is instant (required for nudgeDock timing). Writes to the user's own plist — no sudo
 * needed. Only restarts the Dock if the values weren't already 0. Returns true if Dock was restarted.
 */
function ensureDockAnimationInstant(): boolean {
  const read = spawnSync('defaults', ['read', 'com.apple.dock', 'autohide-time-modifier'], {
    encoding: 'utf-8',
  });
  const current = read.stdout?.trim();
  if (current === '0' || current === '0.0') return false;

  spawnSync('defaults', ['write', 'com.apple.dock', 'autohide-delay', '-float', '0']);
  spawnSync('defaults', ['write', 'com.apple.dock', 'autohide-time-modifier', '-float', '0']);
  spawnSync('killall', ['Dock']);
  return true;
}

async function updateInitLua(
  name: string,
  hotkey?: HotkeyBinding,
  dockScreenWatcherComment = false,
): Promise<'added' | 'updated'> {
  const initLuaPath = resolve(expandHome(INIT_LUA_PATH));

  let existing = '';
  try {
    existing = await readFile(initLuaPath, 'utf-8');
  } catch {
    // File doesn't exist yet — will be created
  }

  const hadBlock = layoutBlockExists(existing, name);
  const updated = upsertLayoutBlock(existing, name, hotkey, dockScreenWatcherComment);

  await mkdir(dirname(initLuaPath), { recursive: true });
  await writeFile(initLuaPath, updated.endsWith('\n') ? updated : `${updated}\n`, 'utf-8');
  return hadBlock ? 'updated' : 'added';
}

// ─── Command ──────────────────────────────────────────────────────────────────

export async function compileCommand({ name, options }: CompileCommandParams): Promise<number> {
  // Load the saved layout JSON
  const loadResult = await loadLayout(name, options.layoutsDir);
  if (!loadResult.ok) {
    console.error(pc.red(`✗ ${loadResult.error}`));
    return EXIT_CODE.LayoutInvalid;
  }

  // Determine output path
  const outputPath = options.output
    ? resolve(options.output)
    : resolve(expandHome(DEFAULT_COMPILE_OUTPUT_DIR), `${name}.lua`);

  // Generate Lua source (optionally with swapped display roles)
  const layout = options.swap ? applyRoleSwap(loadResult.layout) : loadResult.layout;
  const lua = generateLua({ layout });

  // Write compiled Lua to disk (create directory if needed)
  try {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, lua, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(pc.red(`✗ Failed to write ${outputPath}: ${message}`));
    return EXIT_CODE.Error;
  }

  // If dockDisplay is set, ensure Dock animation is instant (required for nudgeDock timing)
  if (loadResult.layout.options?.dockDisplay) {
    const restarted = ensureDockAnimationInstant();
    if (restarted) {
      console.log();
      console.log(
        `  ${pc.bold(pc.green('✓'))} Dock animation set to instant ${pc.dim(
          '(autohide-delay=0, autohide-time-modifier=0)',
        )}`,
      );
    }
  }

  // Update init.lua
  let initLuaStatus: 'added' | 'updated' | 'failed' = 'failed';
  try {
    initLuaStatus = await updateInitLua(
      name,
      loadResult.layout.options?.hotkey,
      !!loadResult.layout.options?.dockDisplay, // optional comment on screen.watcher line
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(pc.yellow(`  ⚠ Could not update init.lua: ${message}`));
  }

  console.log();
  console.log(`  ${pc.bold(pc.green('✓'))} Compiled ${pc.bold(pc.cyan(name))} → ${pc.white(outputPath)}`);
  if (options.swap && layout !== loadResult.layout) {
    const roles = layout.displayRoles;
    const [a, b] =
      roles['secondary'] !== undefined && roles['tertiary'] !== undefined
        ? ['secondary', 'tertiary']
        : ['primary', 'secondary'];
    console.log(`  ${pc.bold(pc.yellow('⇄'))} Roles swapped: ${pc.cyan(a)} ↔ ${pc.cyan(b)}`);
  }

  if (initLuaStatus === 'added') {
    console.log(
      `  ${pc.bold(pc.green('✓'))} Added hotkey to ${pc.white(resolve(expandHome(INIT_LUA_PATH)))}`,
    );
    console.log(`    ${pc.dim('(change the key binding as needed, then reload Hammerspoon config)')}`);
  } else if (initLuaStatus === 'updated') {
    console.log(
      `  ${pc.bold(pc.green('✓'))} Updated hotkey in ${pc.white(resolve(expandHome(INIT_LUA_PATH)))}`,
    );
  }

  console.log();
  return EXIT_CODE.Success;
}
