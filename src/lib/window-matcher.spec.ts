import { describe, expect, it } from 'vitest';

import fixture from '../__mocks__/dump-home-personal.json';
import type { RuntimeWindow } from '../types/runtime.types.js';
import type { WindowRule } from '../types/window.types.js';
import { matchWindows } from './window-matcher.js';

const windows = fixture.windows as unknown as RuntimeWindow[];

// ─── Fixture facts ────────────────────────────────────────────────────────────
//
// Ghostty (com.mitchellh.ghostty) — 5 windows, sorted by (x, y, id):
//   [0] id "51385"  x:-3189, y:379  — "~/repos-finografic/@finografic-core"
//   [1] id "32036"  x:-2961, y: 30  — "~/repos-finografic/git-cli-v2.2"
//   [2] id "32130"  x:-2961, y:594  — "~/repos-finografic/@finografic-core"
//   [3] id "28025"  x:-1280, y:688  — "✳ Git commit request"  isFocused: true
//   [4] id "51890"  x:-1279, y: 30  — "~/repos-finografic/macos-layouts"
//
// Cursor (com.todesktop.230313mzl4w4u92) — 3 windows, sorted by (x, y, id):
//   [0] id "52035"  x:0,    y:30  — "display.types.ts — macos-layouts"
//   [1] id "54687"  x:0,    y:30  — "Untitled-1"
//   [2] id "47152"  x:1920, y:30  — "init.lua — Untitled (Workspace)"

function rule(
  id: string,
  app: WindowRule['app'],
  match: WindowRule['match'],
  extras?: Partial<WindowRule>,
): WindowRule {
  return {
    id,
    app,
    match,
    place: { display: 'main', rect: { x: 0, y: 0, w: 1, h: 1 } },
    ...extras,
  };
}

// Synthetic minimized window for noWindows tests
const minimizedGhostty: RuntimeWindow = {
  id: '99999',
  app: { name: 'Ghostty', bundleId: 'com.mitchellh.ghostty', pid: 99999 },
  title: 'synthetic',
  role: 'AXWindow',
  isStandard: true,
  isMinimized: true,
  isFocused: false,
  screenId: '3',
  frame: { x: 0, y: 0, w: 800, h: 600 },
};

// Ghostty windows with no focused window (all isFocused: false)
const ghosttyNoFocus = windows
  .filter(w => w.app.bundleId === 'com.mitchellh.ghostty')
  .map(w => ({ ...w, isFocused: false }));

describe('matchWindows', () => {
  describe('app matching', () => {
    it('matches by bundleId', () => {
      const rules = [
        rule('r', { bundleId: 'com.mitchellh.ghostty' }, { kind: 'byIndex', index: 0 }),
      ];
      const { matched, skipped } = matchWindows(rules, windows);
      expect(skipped).toHaveLength(0);
      expect(matched).toHaveLength(1);
      expect(matched[0]?.windowId).toBe('51385');
    });

    it('matches by name when bundleId not provided', () => {
      const rules = [rule('r', { name: 'Ghostty' }, { kind: 'byIndex', index: 0 })];
      const { matched, skipped } = matchWindows(rules, windows);
      expect(skipped).toHaveLength(0);
      expect(matched[0]?.windowId).toBe('51385');
    });

    it('skips with appNotRunning when bundleId not found', () => {
      const rules = [rule('r', { bundleId: 'com.nonexistent' }, { kind: 'mainWindow' })];
      const { matched, skipped } = matchWindows(rules, windows);
      expect(matched).toHaveLength(0);
      expect(skipped[0]?.reason).toBe('appNotRunning');
    });

    it('skips with noWindows when all app windows are minimized and restoreMinimized is false', () => {
      const rules = [rule('r', { bundleId: 'com.mitchellh.ghostty' }, { kind: 'mainWindow' })];
      const { matched, skipped } = matchWindows(rules, [minimizedGhostty]);
      expect(matched).toHaveLength(0);
      expect(skipped[0]?.reason).toBe('noWindows');
    });
  });

  describe('byIndex', () => {
    it('byIndex 0 returns leftmost Ghostty window', () => {
      const rules = [
        rule('r', { bundleId: 'com.mitchellh.ghostty' }, { kind: 'byIndex', index: 0 }),
      ];
      const { matched } = matchWindows(rules, windows);
      expect(matched[0]?.windowId).toBe('51385');
    });

    it('byIndex 4 returns rightmost Ghostty window', () => {
      const rules = [
        rule('r', { bundleId: 'com.mitchellh.ghostty' }, { kind: 'byIndex', index: 4 }),
      ];
      const { matched } = matchWindows(rules, windows);
      expect(matched[0]?.windowId).toBe('51890');
    });

    it('byIndex out of range → noMatch', () => {
      const rules = [
        rule('r', { bundleId: 'com.mitchellh.ghostty' }, { kind: 'byIndex', index: 10 }),
      ];
      const { matched, skipped } = matchWindows(rules, windows);
      expect(matched).toHaveLength(0);
      expect(skipped[0]?.reason).toBe('noMatch');
    });

    it('two rules with byIndex 0 and 1 match different windows', () => {
      const rules = [
        rule('a', { bundleId: 'com.mitchellh.ghostty' }, { kind: 'byIndex', index: 0 }),
        rule('b', { bundleId: 'com.mitchellh.ghostty' }, { kind: 'byIndex', index: 1 }),
      ];
      const { matched, skipped } = matchWindows(rules, windows);
      expect(skipped).toHaveLength(0);
      expect(matched).toHaveLength(2);
      expect(matched[0]?.windowId).toBe('51385');
      expect(matched[1]?.windowId).toBe('32036');
    });
  });

  describe('byIndex claim-once', () => {
    it('second rule claiming same byIndex gets noMatch', () => {
      const rules = [
        rule('a', { bundleId: 'com.mitchellh.ghostty' }, { kind: 'byIndex', index: 0 }),
        rule('b', { bundleId: 'com.mitchellh.ghostty' }, { kind: 'byIndex', index: 0 }),
      ];
      const { matched, skipped } = matchWindows(rules, windows);
      expect(matched).toHaveLength(1);
      expect(matched[0]?.ruleId).toBe('a');
      expect(skipped[0]?.ruleId).toBe('b');
      expect(skipped[0]?.reason).toBe('noMatch');
    });

    it('rules claiming byIndex 2 and 1 both succeed (different absolute windows)', () => {
      const rules = [
        rule('a', { bundleId: 'com.mitchellh.ghostty' }, { kind: 'byIndex', index: 2 }),
        rule('b', { bundleId: 'com.mitchellh.ghostty' }, { kind: 'byIndex', index: 1 }),
      ];
      const { matched, skipped } = matchWindows(rules, windows);
      expect(skipped).toHaveLength(0);
      expect(matched).toHaveLength(2);
      expect(matched[0]?.windowId).toBe('32130');
      expect(matched[1]?.windowId).toBe('32036');
    });
  });

  describe('mainWindow', () => {
    it('returns the focused Ghostty window', () => {
      const rules = [rule('r', { bundleId: 'com.mitchellh.ghostty' }, { kind: 'mainWindow' })];
      const { matched } = matchWindows(rules, windows);
      expect(matched[0]?.windowId).toBe('28025');
    });

    it('falls back to index 0 when no window is focused', () => {
      const rules = [rule('r', { bundleId: 'com.mitchellh.ghostty' }, { kind: 'mainWindow' })];
      const { matched } = matchWindows(rules, ghosttyNoFocus);
      expect(matched[0]?.windowId).toBe('51385');
    });
  });

  describe('byTitle', () => {
    it('matches Ghostty window by title regex /macos-layouts/', () => {
      const rules = [
        rule('r', { bundleId: 'com.mitchellh.ghostty' }, {
          kind: 'byTitle',
          pattern: 'macos-layouts',
        }),
      ];
      const { matched } = matchWindows(rules, windows);
      expect(matched[0]?.windowId).toBe('51890');
    });

    it('matches Ghostty window by title regex /git-cli/', () => {
      const rules = [
        rule('r', { bundleId: 'com.mitchellh.ghostty' }, { kind: 'byTitle', pattern: 'git-cli' }),
      ];
      const { matched } = matchWindows(rules, windows);
      expect(matched[0]?.windowId).toBe('32036');
    });

    it('no match → noMatch skip', () => {
      const rules = [
        rule('r', { bundleId: 'com.mitchellh.ghostty' }, {
          kind: 'byTitle',
          pattern: 'nonexistent-app',
        }),
      ];
      const { matched, skipped } = matchWindows(rules, windows);
      expect(matched).toHaveLength(0);
      expect(skipped[0]?.reason).toBe('noMatch');
    });
  });

  describe('all', () => {
    it('all for Cursor returns 3 matches', () => {
      const rules = [rule('r', { bundleId: 'com.todesktop.230313mzl4w4u92' }, { kind: 'all' })];
      const { matched, skipped } = matchWindows(rules, windows);
      expect(skipped).toHaveLength(0);
      expect(matched).toHaveLength(3);
      expect(matched.map(m => m.windowId)).toEqual(['52035', '54687', '47152']);
    });

    it('all with limit:1 returns only 1 match', () => {
      const rules = [
        rule('r', { bundleId: 'com.todesktop.230313mzl4w4u92' }, { kind: 'all' }, { limit: 1 }),
      ];
      const { matched } = matchWindows(rules, windows);
      expect(matched).toHaveLength(1);
      expect(matched[0]?.windowId).toBe('52035');
    });

    it('all after some windows claimed returns only unclaimed', () => {
      const rules = [
        rule('claim', { bundleId: 'com.todesktop.230313mzl4w4u92' }, { kind: 'byIndex', index: 0 }),
        rule('rest', { bundleId: 'com.todesktop.230313mzl4w4u92' }, { kind: 'all' }),
      ];
      const { matched } = matchWindows(rules, windows);
      const restMatches = matched.filter(m => m.ruleId === 'rest');
      expect(restMatches).toHaveLength(2);
      expect(restMatches.map(m => m.windowId)).toEqual(['54687', '47152']);
    });
  });

  describe('cross-app independence', () => {
    it('claiming Ghostty windows does not affect Cursor pool', () => {
      const rules = [
        rule('g0', { bundleId: 'com.mitchellh.ghostty' }, { kind: 'all' }),
        rule('c0', { bundleId: 'com.todesktop.230313mzl4w4u92' }, { kind: 'byIndex', index: 0 }),
      ];
      const { matched, skipped } = matchWindows(rules, windows);
      expect(skipped).toHaveLength(0);
      const cursorMatch = matched.find(m => m.ruleId === 'c0');
      expect(cursorMatch?.windowId).toBe('52035');
    });
  });
});
