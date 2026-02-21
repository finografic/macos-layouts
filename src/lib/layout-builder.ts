import type { DisplayMatch, DisplayRoleMap } from '../types/display.types.js';
import type { NormalizedRect } from '../types/geometry.types.js';
import type { Layout } from '../types/layout.types.js';
import type { RuntimeScreen, RuntimeWindow } from '../types/runtime.types.js';
import type { WindowRule } from '../types/window.types.js';
import { absoluteToNormalized } from './rect-converter.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BuildLayoutParams {
  readonly name: string;
  readonly description?: string;
  readonly dump: { readonly screens: readonly RuntimeScreen[] };
  readonly selectedWindows: readonly RuntimeWindow[];
  readonly displayRoleAssignments: Record<string, RuntimeScreen>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function roundedNormalizedRect(rect: NormalizedRect): NormalizedRect {
  return { x: round4(rect.x), y: round4(rect.y), w: round4(rect.w), h: round4(rect.h) };
}

function toKebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sortWindows(windows: RuntimeWindow[]): RuntimeWindow[] {
  return [...windows].sort((a, b) => {
    if (a.frame.x !== b.frame.x) return a.frame.x - b.frame.x;
    if (a.frame.y !== b.frame.y) return a.frame.y - b.frame.y;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function matcherForScreen(screen: RuntimeScreen): DisplayMatch {
  if (screen.isPrimary) return { kind: 'primary' };
  if (screen.isBuiltin) return { kind: 'builtin' };
  return { kind: 'byName', name: screen.name };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildLayout({
  name,
  description,
  selectedWindows,
  displayRoleAssignments,
}: BuildLayoutParams): Layout {
  // 1. Build displayRoles — order: primary first, builtin second, others alphabetically
  const entries = Object.entries(displayRoleAssignments);
  entries.sort(([, a], [, b]) => {
    const rank = (s: RuntimeScreen) => (s.isPrimary ? 0 : s.isBuiltin ? 1 : 2);
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  const displayRoles: DisplayRoleMap = {};
  for (const [roleName, screen] of entries) {
    displayRoles[roleName] = { match: matcherForScreen(screen) };
  }

  // Build reverse map: screenId → roleName
  const screenIdToRole = new Map<string, string>();
  for (const [roleName, screen] of Object.entries(displayRoleAssignments)) {
    screenIdToRole.set(screen.id, roleName);
  }

  // 2. Build window rules — group by app, sort, assign byIndex
  const windowsByApp = new Map<string, RuntimeWindow[]>();
  for (const w of selectedWindows) {
    const key = w.app.bundleId ?? w.app.name;
    const group = windowsByApp.get(key) ?? [];
    group.push(w);
    windowsByApp.set(key, group);
  }
  // Sort each app group once
  for (const [key, group] of windowsByApp) {
    windowsByApp.set(key, sortWindows(group));
  }

  const rules: WindowRule[] = [];
  // Track per-app index counters
  const appIndexCounters = new Map<string, number>();

  for (const w of selectedWindows) {
    const roleName = screenIdToRole.get(w.screenId);
    if (roleName === undefined) {
      // Window on unassigned screen — skip
      continue;
    }

    const screen = displayRoleAssignments[roleName];
    if (!screen) continue;

    const appKey = w.app.bundleId ?? w.app.name;
    const appGroup = windowsByApp.get(appKey) ?? [];
    const byIndexValue = appGroup.findIndex((gw) => gw.id === w.id);

    // Per-app counter for rule ID generation
    const idIndex = appIndexCounters.get(appKey) ?? 0;
    appIndexCounters.set(appKey, idIndex + 1);

    const appSlug = toKebab(w.app.name || 'unknown');
    const ruleId = `${appSlug}-${idIndex}`;

    const normalizedRect = roundedNormalizedRect(
      absoluteToNormalized(w.frame, screen.frame),
    );

    const rule: WindowRule = {
      id: ruleId,
      app: {
        ...(w.app.bundleId !== null ? { bundleId: w.app.bundleId } : {}),
        name: w.app.name,
      },
      match: { kind: 'byIndex', index: byIndexValue >= 0 ? byIndexValue : 0 },
      place: { display: roleName, rect: normalizedRect },
    };

    rules.push(rule);
  }

  // 3. Assemble layout
  const layout: Layout = {
    version: '0.1',
    name,
    ...(description !== undefined ? { description } : {}),
    displayRoles,
    windows: rules,
  };

  return layout;
}
