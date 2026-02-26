/**
 * @finografic/macos-layouts — dump command
 *
 * Queries Hammerspoon for current screen and window state,
 * then outputs structured JSON or human-readable text.
 */

import pc from 'picocolors';

import { DUMP_LUA } from '../lib/dump-lua.js';
import * as hs from '../lib/hammerspoon.js';
import type { DumpOptions } from '../types/cli.types.js';
import { EXIT_CODE } from '../types/cli.types.js';
import type { RuntimeDump, RuntimeScreen, RuntimeWindow } from '../types/runtime.types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DumpCommandParams {
  readonly options: DumpOptions;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_TITLE_LENGTH = 60;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function screenOrientation({ frame }: RuntimeScreen): string {
  return frame.h > frame.w ? 'portrait' : 'landscape';
}

function printHumanReadable(dump: RuntimeDump): void {
  console.log('');
  console.log(pc.bold('Screens'));
  for (const s of dump.screens) {
    const builtinTag = s.isBuiltin ? pc.dim(' [built-in]') : '';
    const meta = `${s.resolution.w}×${s.resolution.h}, ${screenOrientation(s)}`;
    console.log(`  ${pc.cyan(s.name)}${builtinTag}  ${pc.dim(meta)}`);
    console.log(`    id: ${s.id}  frame: ${s.frame.x},${s.frame.y}  ${s.frame.w}×${s.frame.h}`);
  }

  console.log('');
  console.log(pc.bold('Windows'));

  const byApp = new Map<string, RuntimeWindow[]>();
  for (const w of dump.windows) {
    const key = w.app.name || '(unknown)';
    const group = byApp.get(key) ?? [];
    group.push(w);
    byApp.set(key, group);
  }

  for (const [appName, windows] of byApp) {
    console.log(`  ${pc.bold(pc.cyan(appName))}`);
    for (const w of windows) {
      const title = truncate(w.title, MAX_TITLE_LENGTH);
      const focusTag = w.isFocused ? pc.yellow(' [focused]') : '';
      const minimizedTag = w.isMinimized ? pc.dim(' [minimized]') : '';
      console.log(`    ${pc.dim(`[${w.id}]`)} ${title}${focusTag}${minimizedTag}`);
      console.log(
        `      screen: ${w.screenId}  frame: ${w.frame.x},${w.frame.y}  ${w.frame.w}×${w.frame.h}`,
      );
    }
  }

  console.log('');
}

// ─── Command ──────────────────────────────────────────────────────────────────

export async function dumpCommand({ options }: DumpCommandParams): Promise<number> {
  const available = await hs.isAvailable();
  if (!available) {
    console.error(
      `${
        pc.red('Error:')
      } Hammerspoon is not available. Is \`hs\` on your PATH and Hammerspoon running?`,
    );
    return EXIT_CODE.RuntimeUnavailable;
  }

  const result = await hs.dump({ lua: DUMP_LUA });
  if (!result.ok) {
    console.error(`${pc.red('Error:')} ${result.error.message}`);
    return EXIT_CODE.Error;
  }

  const raw = result.value;

  const windows = raw.windows.filter((w) => {
    if (!options.includeMinimized && w.isMinimized) return false;
    if (!w.isStandard) return false;
    return true;
  });

  const filtered: RuntimeDump = { ...raw, windows };

  if (options.pretty) {
    console.log(JSON.stringify(filtered, null, 2));
    return EXIT_CODE.Success;
  }

  if (options.json) {
    console.log(JSON.stringify(filtered));
    return EXIT_CODE.Success;
  }

  printHumanReadable(filtered);
  return EXIT_CODE.Success;
}
