/**
 * @finografic/macos-layouts — dump command
 *
 * Queries Hammerspoon for current screen and window state,
 * then outputs structured JSON or human-readable text.
 */

import pc from 'picocolors';

import * as hs from '../lib/hammerspoon.js';
import type { DumpOptions } from '../types/cli.types.js';
import { EXIT_CODE } from '../types/cli.types.js';
import type { RuntimeDump, RuntimeScreen, RuntimeWindow } from '../types/runtime.types.js';

// ─── Lua script ───────────────────────────────────────────────────────────────

/**
 * Self-contained Lua script — no require(), no external files.
 * Runs in the live Hammerspoon instance via `hs -c`.
 * Returns a JSON string matching the RuntimeDump shape.
 */
const DUMP_LUA = `
return (function()
  local focused = hs.window.focusedWindow()
  local focusedId = focused and focused:id() or nil
  local builtinScreen = hs.screen.find("Built%-in")
  local builtinId = builtinScreen and builtinScreen:id() or nil

  local screens = {}
  for _, s in ipairs(hs.screen.allScreens()) do
    local f = s:frame()
    local ff = s:fullFrame()
    local mode = s:currentMode()
    table.insert(screens, {
      id = tostring(s:id()),
      name = s:name() or "",
      isBuiltin = (s:id() == builtinId),
      frame = { x = f.x, y = f.y, w = f.w, h = f.h },
      fullFrame = { x = ff.x, y = ff.y, w = ff.w, h = ff.h },
      resolution = { w = mode and mode.w or ff.w, h = mode and mode.h or ff.h }
    })
  end

  local windows = {}
  for _, w in ipairs(hs.window.allWindows()) do
    local app = w:application()
    local wf = w:frame()
    local ws = w:screen()
    table.insert(windows, {
      id = tostring(w:id()),
      app = {
        name = app and app:name() or "",
        bundleId = app and app:bundleID() or hs.json.NULL,
        pid = app and app:pid() or 0
      },
      title = w:title() or "",
      role = w:role() or "",
      isStandard = w:isStandard(),
      isMinimized = w:isMinimized(),
      isFocused = (w:id() == focusedId),
      screenId = ws and tostring(ws:id()) or "",
      frame = { x = wf.x, y = wf.y, w = wf.w, h = wf.h }
    })
  end

  return hs.json.encode({
    timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ"),
    screens = screens,
    windows = windows
  })
end)()
`.trim();

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
    if (!options.includeHidden && !w.isStandard) return false;
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
