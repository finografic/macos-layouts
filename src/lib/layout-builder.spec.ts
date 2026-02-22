import { describe, expect, it } from 'vitest';

import fixture from '../__mocks__/dump-home-personal.json';
import type { RuntimeScreen, RuntimeWindow } from '../types/runtime.types.js';
import { buildLayout } from './layout-builder.js';
import { normalizedToAbsolute } from './rect-converter.js';

// ─── Fixture data ─────────────────────────────────────────────────────────────

const screens = fixture.screens as unknown as RuntimeScreen[];
// Screen id "4" = LG HDR 4K, isPrimary: true,  frame: {x:0, y:30, w:3840, h:2130}
// Screen id "3" = LG Ultra HD, isPrimary: false, frame: {x:-3840, y:30, w:3840, h:2082}
const primaryScreen = screens.find((s) => s.id === '4')!;
const secondaryScreen = screens.find((s) => s.id === '3')!;

// Pick a couple of real windows from the fixture
const cursorWindows = (fixture.windows as unknown as RuntimeWindow[]).filter(
  (w) => w.app.bundleId === 'com.todesktop.230313mzl4w4u92',
);
const ghosttyWindows = (fixture.windows as unknown as RuntimeWindow[]).filter(
  (w) => w.app.bundleId === 'com.mitchellh.ghostty',
);
const obsidianWindow = (fixture.windows as unknown as RuntimeWindow[]).find(
  (w) => w.app.bundleId === 'md.obsidian',
)!;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildLayout', () => {
  it('single window → correct normalized rect and display role reference', () => {
    const layout = buildLayout({
      name: 'test',
      dump: { screens },
      selectedWindows: [obsidianWindow],
      displayRoleAssignments: { secondary: secondaryScreen },
    });

    expect(layout.windows).toHaveLength(1);
    const rule = layout.windows[0]!;
    expect(rule.place.display).toBe('secondary');
    // Obsidian is on screen "3" (x:-3840), frame {x:-3840, y:30, w:2560, h:1394}
    // Normalized: x=(−3840−(−3840))/3840=0, y=(30−30)/2082=0, w=2560/3840≈0.6667, h=1394/2082≈0.6696
    expect(rule.place.rect.x).toBeCloseTo(0, 4);
    expect(rule.place.rect.y).toBeCloseTo(0, 4);
    expect(rule.place.rect.w).toBeCloseTo(2560 / 3840, 4);
    expect(rule.place.rect.h).toBeCloseTo(1394 / 2082, 4);
  });

  it('multiple windows same app → unique ids and incrementing byIndex', () => {
    const twoWindows = cursorWindows.slice(0, 2);
    const layout = buildLayout({
      name: 'multi',
      dump: { screens },
      selectedWindows: twoWindows,
      displayRoleAssignments: { primary: primaryScreen },
    });

    expect(layout.windows).toHaveLength(2);
    const ids = layout.windows.map((r) => r.id);
    expect(new Set(ids).size).toBe(2); // all unique
    // Both should be byIndex with consecutive values
    const indices = layout.windows.map((r) => (r.match as { index: number }).index);
    expect(indices).toContain(0);
    expect(indices).toContain(1);
  });

  it('window on primary screen → displayRole uses primary matcher', () => {
    const primaryWindow = cursorWindows.find((w) => w.screenId === '4')!;
    const layout = buildLayout({
      name: 'prim',
      dump: { screens },
      selectedWindows: [primaryWindow],
      displayRoleAssignments: { main: primaryScreen },
    });

    expect(layout.displayRoles['main']?.match).toEqual({ kind: 'primary' });
  });

  it('window on non-primary non-builtin screen → displayRole uses byName matcher', () => {
    const layout = buildLayout({
      name: 'external',
      dump: { screens },
      selectedWindows: [obsidianWindow],
      displayRoleAssignments: { secondary: secondaryScreen },
    });

    expect(layout.displayRoles['secondary']?.match).toEqual({
      kind: 'byName',
      name: 'LG Ultra HD',
    });
  });

  it('normalized rect round-trip → recovers original frame within rounding tolerance', () => {
    const win = obsidianWindow;
    const layout = buildLayout({
      name: 'roundtrip',
      dump: { screens },
      selectedWindows: [win],
      displayRoleAssignments: { secondary: secondaryScreen },
    });

    const rule = layout.windows[0]!;
    const recovered = normalizedToAbsolute(rule.place.rect, secondaryScreen.frame);

    // normalizedToAbsolute and absoluteToNormalized both round, so tolerance = ±1 px
    expect(Math.abs(recovered.x - win.frame.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(recovered.y - win.frame.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(recovered.w - win.frame.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(recovered.h - win.frame.h)).toBeLessThanOrEqual(1);
  });

  it('empty selectedWindows → layout with empty windows array', () => {
    const layout = buildLayout({
      name: 'empty',
      dump: { screens },
      selectedWindows: [],
      displayRoleAssignments: { primary: primaryScreen },
    });

    expect(layout.windows).toHaveLength(0);
    expect(layout.name).toBe('empty');
  });

  it('window on unassigned screen → skipped (not in layout)', () => {
    // Obsidian is on secondary (screen "3"), but we only assign "primary" (screen "4")
    const layout = buildLayout({
      name: 'unassigned',
      dump: { screens },
      selectedWindows: [obsidianWindow],
      displayRoleAssignments: { primary: primaryScreen },
    });

    expect(layout.windows).toHaveLength(0);
  });

  it('description is optional — omitted when undefined', () => {
    const withDesc = buildLayout({
      name: 'a',
      description: 'My layout',
      dump: { screens },
      selectedWindows: [],
      displayRoleAssignments: {},
    });
    const withoutDesc = buildLayout({
      name: 'b',
      dump: { screens },
      selectedWindows: [],
      displayRoleAssignments: {},
    });

    expect(withDesc.description).toBe('My layout');
    expect('description' in withoutDesc).toBe(false);
  });

  it('primary role ordered first in displayRoles regardless of input order', () => {
    const layout = buildLayout({
      name: 'order',
      dump: { screens },
      selectedWindows: [],
      displayRoleAssignments: {
        secondary: secondaryScreen,
        primary: primaryScreen,
      },
    });

    const roleNames = Object.keys(layout.displayRoles);
    expect(roleNames[0]).toBe('primary');
    expect(roleNames[1]).toBe('secondary');
  });

  it('ghostty windows each get unique byIndex values when multiple selected', () => {
    const twoGhostty = ghosttyWindows.slice(0, 2);
    // Both might be on the same screen or different — just check uniqueness
    const layout = buildLayout({
      name: 'ghostty-test',
      dump: { screens },
      selectedWindows: twoGhostty,
      displayRoleAssignments: { primary: primaryScreen, secondary: secondaryScreen },
    });

    const indices = layout.windows
      .filter((r) => r.app.bundleId === 'com.mitchellh.ghostty')
      .map((r) => (r.match as { index: number }).index);
    // Each window should have a distinct byIndex
    expect(new Set(indices).size).toBe(indices.length);
  });
});
