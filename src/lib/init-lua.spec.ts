import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildLayoutInitSnippet,
  hotkeysEqual,
  parseInitLuaLayoutHotkeys,
  removeLayoutBlock,
  upsertLayoutBlock,
  validateHotkeyForLayout,
} from 'lib/init-lua.js';

const SAMPLE_INIT = `-- commented legacy
-- -- 🖥️ macos-layouts: home
-- hs.hotkey.bind({"ctrl","shift"}, "pad0", _layoutsApply_home)

-- 🖥️ macos-layouts: oz-dev
local _layoutsApply_oz_dev_lastRun = 0
local function _layoutsApply_oz_dev()
  dofile(os.getenv("HOME") .. "/.hammerspoon/layouts/oz-dev.lua")
end
hs.hotkey.bind({"ctrl"}, "pad0", _layoutsApply_oz_dev)
hs.screen.watcher.new(_layoutsApply_oz_dev):start()

-- 🖥️ macos-layouts: oz-dev-expanded
local _layoutsApply_oz_dev_expanded_lastRun = 0
local function _layoutsApply_oz_dev_expanded()
  dofile(os.getenv("HOME") .. "/.hammerspoon/layouts/oz-dev-expanded.lua")
end
hs.hotkey.bind({"alt", "cmd", "ctrl", "shift"}, "pad0", _layoutsApply_oz_dev_expanded)
hs.screen.watcher.new(_layoutsApply_oz_dev_expanded):start()
`;

describe('parseInitLuaLayoutHotkeys', () => {
  it('ignores commented blocks and parses active layout hotkeys', () => {
    const entries = parseInitLuaLayoutHotkeys(SAMPLE_INIT);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      layoutName: 'oz-dev',
      hotkey: { mods: ['ctrl'], key: 'pad0' },
    });
    expect(entries[1]).toEqual({
      layoutName: 'oz-dev-expanded',
      hotkey: { mods: ['alt', 'cmd', 'ctrl', 'shift'], key: 'pad0' },
    });
  });

  it('parses real ~/.hammerspoon/init.lua when present', async () => {
    const path = join(homedir(), '.hammerspoon', 'init.lua');
    let content = '';
    try {
      content = await readFile(path, 'utf-8');
    } catch {
      return;
    }
    const entries = parseInitLuaLayoutHotkeys(content);
    expect(entries.some((e) => e.layoutName === 'oz-dev')).toBe(true);
  });
});

describe('validateHotkeyForLayout', () => {
  const entries = parseInitLuaLayoutHotkeys(SAMPLE_INIT);

  it('accepts same layout + same hotkey (overwrite)', () => {
    expect(validateHotkeyForLayout('oz-dev', { mods: ['ctrl'], key: 'pad0' }, entries)).toBe('accept');
  });

  it('accepts same layout + different hotkey (reassign)', () => {
    expect(validateHotkeyForLayout('oz-dev', { mods: ['ctrl', 'shift'], key: 'pad1' }, entries)).toBe(
      'accept',
    );
  });

  it('rejects different layout + same hotkey as another entry', () => {
    expect(validateHotkeyForLayout('test', { mods: ['ctrl'], key: 'pad0' }, entries)).toBe('conflict');
  });

  it('accepts a hotkey not used by any other layout', () => {
    expect(validateHotkeyForLayout('test', { mods: ['cmd'], key: 'h' }, entries)).toBe('accept');
  });
});

describe('hotkeysEqual', () => {
  it('compares mods regardless of order', () => {
    expect(
      hotkeysEqual({ mods: ['ctrl', 'shift'], key: 'pad0' }, { mods: ['shift', 'ctrl'], key: 'pad0' }),
    ).toBe(true);
  });
});

describe('upsertLayoutBlock', () => {
  it('replaces an existing layout block with a new hotkey', () => {
    const updated = upsertLayoutBlock(SAMPLE_INIT, 'oz-dev', { mods: ['ctrl', 'shift'], key: 'pad1' });
    expect(updated).toContain('hs.hotkey.bind({"ctrl", "shift"}, "pad1", _layoutsApply_oz_dev)');
    expect(updated).not.toMatch(/hs\.hotkey\.bind\(\{"ctrl"\}, "pad0", _layoutsApply_oz_dev\)/);
    expect(parseInitLuaLayoutHotkeys(updated)).toContainEqual({
      layoutName: 'oz-dev',
      hotkey: { mods: ['ctrl', 'shift'], key: 'pad1' },
    });
    expect(parseInitLuaLayoutHotkeys(updated)).toHaveLength(2);
  });

  it('appends a new layout block', () => {
    const snippet = buildLayoutInitSnippet('test', { mods: ['cmd'], key: 'h' });
    const updated = upsertLayoutBlock(SAMPLE_INIT, 'test', { mods: ['cmd'], key: 'h' });
    expect(updated).toContain(snippet.trim());
    expect(parseInitLuaLayoutHotkeys(updated)).toHaveLength(3);
  });
});

describe('removeLayoutBlock', () => {
  it('removes one layout without touching others', () => {
    const trimmed = removeLayoutBlock(SAMPLE_INIT, 'oz-dev');
    const entries = parseInitLuaLayoutHotkeys(trimmed);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.layoutName).toBe('oz-dev-expanded');
  });
});
