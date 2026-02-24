import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import pc from 'picocolors';

import { DEFAULT_COMPILE_OUTPUT_DIR, INIT_LUA_PATH } from '../config/defaults.constants.js';
import { expandHome, loadLayout } from '../lib/layout-loader.js';
import { generateLua } from '../lib/lua-codegen.js';
import type { CompileOptions } from '../types/cli.types.js';
import { EXIT_CODE } from '../types/cli.types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompileCommandParams {
  readonly name: string;
  readonly options: CompileOptions;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInitSnippet(
  name: string,
  hotkey?: { readonly mods: readonly string[]; readonly key: string },
): string {
  const path = `os.getenv("HOME") .. "/.hammerspoon/layouts/${name}.lua"`;
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
  const fn = `_mlApply_${safeName}`;
  const hotkeyLine = hotkey
    ? `hs.hotkey.bind({${hotkey.mods.map((m) => `"${m}"`).join(', ')}}, "${hotkey.key}", ${fn})`
    : `hs.hotkey.bind({"cmd","alt"}, "h", ${fn})  -- change key binding as needed`;
  return [
    '',
    `-- layouts: ${name}`,
    `local ${fn}_lastRun = 0`,
    `local function ${fn}()`,
    `  local now = hs.timer.secondsSinceEpoch()`,
    `  if now - ${fn}_lastRun < 2.0 then return end`,
    `  ${fn}_lastRun = now`,
    `  dofile(${path})`,
    `end`,
    hotkeyLine,
    `hs.screen.watcher.new(${fn}):start()         -- re-applies when Dock moves/shows/hides`,
    '',
  ].join('\n');
}

/**
 * Ensures Dock animation is instant (required for nudgeDock timing).
 * Writes to the user's own plist — no sudo needed.
 * Only restarts the Dock if the values weren't already 0.
 * Returns true if Dock was restarted.
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
  hotkey?: { readonly mods: readonly string[]; readonly key: string },
): Promise<'added' | 'exists'> {
  const initLuaPath = resolve(expandHome(INIT_LUA_PATH));
  const marker = `layouts/${name}.lua`;

  let existing = '';
  try {
    existing = await readFile(initLuaPath, 'utf-8');
  } catch {
    // File doesn't exist yet — will be created
  }

  if (existing.includes(marker)) {
    return 'exists';
  }

  await mkdir(dirname(initLuaPath), { recursive: true });
  await writeFile(initLuaPath, existing + buildInitSnippet(name, hotkey), 'utf-8');
  return 'added';
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

  // Generate Lua source
  const lua = generateLua({ layout: loadResult.layout });

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
        `  ${pc.bold(pc.green('✓'))} Dock animation set to instant ${
          pc.dim('(autohide-delay=0, autohide-time-modifier=0)')
        }`,
      );
    }
  }

  // Update init.lua
  let initLuaStatus: 'added' | 'exists' | 'failed' = 'failed';
  try {
    initLuaStatus = await updateInitLua(name, loadResult.layout.options?.hotkey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(pc.yellow(`  ⚠ Could not update init.lua: ${message}`));
  }

  console.log();
  console.log(
    `  ${pc.bold(pc.green('✓'))} Compiled ${pc.bold(pc.cyan(name))} → ${pc.white(outputPath)}`,
  );

  if (initLuaStatus === 'added') {
    console.log(
      `  ${pc.bold(pc.green('✓'))} Added hotkey to ${pc.white(resolve(expandHome(INIT_LUA_PATH)))}`,
    );
    console.log(
      `    ${pc.dim('(change the key binding as needed, then reload Hammerspoon config)')}`,
    );
  } else if (initLuaStatus === 'exists') {
    console.log(
      `  ${pc.dim(`~ init.lua already contains a hotkey for "${name}"`)}`,
    );
  }

  console.log();
  return EXIT_CODE.Success;
}
