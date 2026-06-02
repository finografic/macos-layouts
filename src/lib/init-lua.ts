import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expandHome } from 'lib/layout-loader.js';

import { INIT_LUA_PATH } from 'config/defaults.constants.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HotkeyBinding {
  readonly mods: readonly string[];
  readonly key: string;
}

export interface LayoutHotkeyEntry {
  readonly layoutName: string;
  readonly hotkey: HotkeyBinding;
}

export type HotkeyValidationResult = 'accept' | 'conflict';

// ─── Constants ────────────────────────────────────────────────────────────────

const LAYOUT_MARKER_PREFIX = '🖥️ macos-layouts:';
const MARKER_LINE_RE = /^--\s*🖥️ macos-layouts:\s*(.+?)\s*$/;
const HOTKEY_BIND_RE = /^hs\.hotkey\.bind\(\{([^}]*)\},\s*"([^"]+)"/;
const COMMENT_LINE_RE = /^\s*--/;

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseModsFromLua(modsBody: string): string[] {
  const mods: string[] = [];
  const re = /"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(modsBody)) !== null) {
    const mod = match[1];
    if (mod !== undefined) mods.push(mod);
  }
  return mods.toSorted();
}

/** Parse active (uncommented) layout hotkey bindings from init.lua. Section markers are comment lines. */
export function parseInitLuaLayoutHotkeys(content: string): LayoutHotkeyEntry[] {
  const entries: LayoutHotkeyEntry[] = [];
  let currentLayout: string | null = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    const markerMatch = trimmed.match(MARKER_LINE_RE);
    if (markerMatch) {
      const layoutFromMarker = markerMatch[1];
      if (layoutFromMarker !== undefined) currentLayout = layoutFromMarker.trim();
      continue;
    }

    if (COMMENT_LINE_RE.test(trimmed)) continue;

    const hotkeyMatch = trimmed.match(HOTKEY_BIND_RE);
    if (hotkeyMatch && currentLayout) {
      const modsBody = hotkeyMatch[1];
      const key = hotkeyMatch[2];
      if (modsBody !== undefined && key !== undefined) {
        entries.push({
          layoutName: currentLayout,
          hotkey: {
            mods: parseModsFromLua(modsBody),
            key,
          },
        });
      }
    }
  }

  return entries;
}

export function hotkeysEqual(a: HotkeyBinding, b: HotkeyBinding): boolean {
  if (a.key !== b.key) return false;
  const modsA = [...a.mods].toSorted().join(',');
  const modsB = [...b.mods].toSorted().join(',');
  return modsA === modsB;
}

/**
 * Accept when reusing or reassigning hotkeys for the same layout name.
 * Conflict when another layout already owns the same hotkey combo.
 */
export function validateHotkeyForLayout(
  layoutName: string,
  hotkey: HotkeyBinding,
  entries: readonly LayoutHotkeyEntry[],
): HotkeyValidationResult {
  for (const entry of entries) {
    if (entry.layoutName === layoutName) continue;
    if (hotkeysEqual(entry.hotkey, hotkey)) return 'conflict';
  }
  return 'accept';
}

export async function readInitLuaContent(): Promise<string> {
  const initLuaPath = resolve(expandHome(INIT_LUA_PATH));
  try {
    return await readFile(initLuaPath, 'utf-8');
  } catch {
    return '';
  }
}

// ─── Snippet generation ───────────────────────────────────────────────────────

/**
 * Init.lua snippet (V1): debounced apply shared by hotkey and screen watcher. A raw `dofile` in the hotkey
 * path was prone to bad interactions (e.g. Finder); throttling all entry points and using
 * `hs.screen.watcher.new(fn)` fixes that.
 */
export function buildLayoutInitSnippet(
  name: string,
  hotkey?: HotkeyBinding,
  dockScreenWatcherComment = false,
): string {
  const path = `os.getenv("HOME") .. "/.hammerspoon/layouts/${name}.lua"`;
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
  const fn = `_layoutsApply_${safeName}`;
  const lastRun = `${fn}_lastRun`;
  const hotkeyLine = hotkey
    ? `hs.hotkey.bind({${hotkey.mods.map((m) => `"${m}"`).join(', ')}}, "${hotkey.key}", ${fn})`
    : `hs.hotkey.bind({"cmd","alt"}, "h", ${fn})  -- change key binding as needed`;

  const watcherSuffix = dockScreenWatcherComment ? '  -- re-applies when Dock moves/shows/hides' : '';

  const lines = [
    '',
    `-- ${LAYOUT_MARKER_PREFIX} ${name}`,
    `local ${lastRun} = 0`,
    `local function ${fn}()`,
    `  local now = hs.timer.secondsSinceEpoch()`,
    `  if now - ${lastRun} < 2.0 then return end`,
    `  ${lastRun} = now`,
    `  dofile(${path})`,
    `end`,
    hotkeyLine,
    `hs.screen.watcher.new(${fn}):start()${watcherSuffix}`,
    '',
  ];

  return lines.join('\n');
}

/** Remove one layout block (marker through screen watcher) from init.lua content. */
export function removeLayoutBlock(content: string, layoutName: string): string {
  const lines = content.split('\n');
  const markerLine = `-- ${LAYOUT_MARKER_PREFIX} ${layoutName}`;
  let startIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && line.trim() === markerLine) {
      startIdx = i;
      break;
    }
  }

  if (startIdx === -1) return content;

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && line.trim().startsWith(`-- ${LAYOUT_MARKER_PREFIX}`)) {
      endIdx = i;
      break;
    }
  }

  const before = lines.slice(0, startIdx).join('\n').replace(/\n+$/, '');
  const after = lines.slice(endIdx).join('\n').replace(/^\n+/, '');

  if (!before && !after) return '';
  if (!before) return after;
  if (!after) return before;
  return `${before}\n\n${after}`;
}

/** Replace an existing layout block or append a new one. */
export function upsertLayoutBlock(
  existing: string,
  layoutName: string,
  hotkey?: HotkeyBinding,
  dockScreenWatcherComment = false,
): string {
  const without = removeLayoutBlock(existing, layoutName);
  const snippet = buildLayoutInitSnippet(layoutName, hotkey, dockScreenWatcherComment);
  if (!without.trim()) return snippet.trimStart();
  return without + snippet;
}

export function layoutBlockExists(content: string, layoutName: string): boolean {
  return content.includes(`-- ${LAYOUT_MARKER_PREFIX} ${layoutName}`);
}
