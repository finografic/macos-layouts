import { describe, expect, it } from 'vitest';
import type { Layout } from '../types/layout.types.js';

import { generateLua } from './lua-codegen.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_LAYOUT: Layout = {
  version: '0.1',
  name: 'test',
  displayRoles: { main: { match: { kind: 'primary' } } },
  windows: [
    {
      id: 'cursor-0',
      app: { bundleId: 'com.todesktop.230313mzl4w4u92', name: 'Cursor' },
      match: { kind: 'mainWindow' },
      place: { display: 'main', rect: { x: 0, y: 0, w: 1, h: 1 } },
    },
    {
      id: 'obsidian-0',
      app: { bundleId: 'md.obsidian', name: 'Obsidian' },
      match: { kind: 'byIndex', index: 0 },
      place: { display: 'main', rect: { x: 0, y: 0, w: 0.5, h: 1 } },
    },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateLua — collectWindows', () => {
  it('uses hs.application.runningApplications(), not hs.window.allWindows()', () => {
    const lua = generateLua({ layout: BASE_LAYOUT });
    expect(lua).toContain('hs.application.runningApplications()');
    expect(lua).not.toContain('hs.window.allWindows()');
  });

  it('populates targetBundleIds from layout rules', () => {
    const lua = generateLua({ layout: BASE_LAYOUT });
    expect(lua).toContain('targetBundleIds');
    expect(lua).toContain('com.todesktop.230313mzl4w4u92');
    expect(lua).toContain('md.obsidian');
  });
});

describe('generateLua — setFrame', () => {
  it('passes explicit 0 duration to setFrame', () => {
    const lua = generateLua({ layout: BASE_LAYOUT });
    expect(lua).toMatch(/setFrame\(.*,\s*0\)/s);
  });
});

describe('generateLua — dockDisplay', () => {
  it('does not embed dockDisplay in LAYOUT data when not set', () => {
    const lua = generateLua({ layout: BASE_LAYOUT });
    // nudgeDock/hs.timer.doAfter are always in the static template,
    // but LAYOUT.options.dockDisplay in the data block controls whether they run
    expect(lua).not.toContain('dockDisplay =');
  });

  it('embeds dockDisplay in LAYOUT data when set', () => {
    const layout: Layout = { ...BASE_LAYOUT, options: { dockDisplay: 'main' } };
    const lua = generateLua({ layout });
    expect(lua).toContain('dockDisplay = "main"');
  });
});

describe('generateLua — layout data', () => {
  it('embeds the layout name in the file header', () => {
    const lua = generateLua({ layout: BASE_LAYOUT });
    expect(lua).toContain('-- 🖥️ macos-layouts: test');
    expect(lua).toContain('"test"');
  });

  it('embeds all window bundle IDs', () => {
    const lua = generateLua({ layout: BASE_LAYOUT });
    expect(lua).toContain('com.todesktop.230313mzl4w4u92');
    expect(lua).toContain('md.obsidian');
  });

  it('embeds normalized rect values', () => {
    const lua = generateLua({ layout: BASE_LAYOUT });
    expect(lua).toContain('x = 0, y = 0, w = 0.5, h = 1');
  });
});
