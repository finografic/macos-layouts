import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import pc from 'picocolors';

import { expandHome, loadLayout } from '../lib/layout-loader.js';
import { generateLua } from '../lib/lua-codegen.js';
import type { CompileOptions } from '../types/cli.types.js';
import { EXIT_CODE } from '../types/cli.types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_OUTPUT_DIR = '~/.hammerspoon/layouts';
const INIT_LUA_PATH = '~/.hammerspoon/init.lua';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompileCommandParams {
  readonly name: string;
  readonly options: CompileOptions;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildHotkeySnippet(name: string): string {
  return [
    '',
    `-- macos-layouts: ${name} (change key binding as needed)`,
    `hs.hotkey.bind({"cmd","alt"}, "h", function()`,
    `  dofile(os.getenv("HOME") .. "/.hammerspoon/layouts/${name}.lua")`,
    `end)`,
    '',
  ].join('\n');
}

async function updateInitLua(name: string): Promise<'added' | 'exists'> {
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
  await writeFile(initLuaPath, existing + buildHotkeySnippet(name), 'utf-8');
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
    : resolve(expandHome(DEFAULT_OUTPUT_DIR), `${name}.lua`);

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

  // Update init.lua
  let initLuaStatus: 'added' | 'exists' | 'failed' = 'failed';
  try {
    initLuaStatus = await updateInitLua(name);
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
