import type { SkipReason } from '../types/runtime.types.js';
import type { RuntimeWindow } from '../types/runtime.types.js';
import type { WindowRule } from '../types/window.types.js';

// ─── Result types ─────────────────────────────────────────────────────────────

export interface WindowMatchResult {
  readonly ruleId: string;
  readonly windowId: string;
  readonly window: RuntimeWindow;
}

export interface WindowSkipResult {
  readonly ruleId: string;
  readonly app: string;
  readonly reason: SkipReason;
}

export interface MatchResult {
  readonly matched: readonly WindowMatchResult[];
  readonly skipped: readonly WindowSkipResult[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function appLabel(rule: WindowRule): string {
  return rule.app.bundleId ?? rule.app.name ?? '(unknown)';
}

function sortWindows(windows: RuntimeWindow[]): RuntimeWindow[] {
  return [...windows].sort((a, b) => {
    if (a.frame.x !== b.frame.x) return a.frame.x - b.frame.x;
    if (a.frame.y !== b.frame.y) return a.frame.y - b.frame.y;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function matchWindows(
  rules: readonly WindowRule[],
  windows: readonly RuntimeWindow[],
  options?: { restoreMinimized?: boolean },
): MatchResult {
  const restoreMinimized = options?.restoreMinimized ?? false;

  // Track all known apps (before eligibility filtering) to distinguish
  // "app not running" from "app running but all windows filtered out"
  const knownBundleIds = new Set<string>();
  const knownNames = new Set<string>();

  for (const w of windows) {
    if (w.app.bundleId !== null) knownBundleIds.add(w.app.bundleId);
    knownNames.add(w.app.name);
  }

  // Build per-app pools from eligible windows only (sorted once, used immutably)
  const poolByBundleId = new Map<string, RuntimeWindow[]>();
  const poolByName = new Map<string, RuntimeWindow[]>();

  for (const w of windows) {
    if (!w.isStandard) continue;
    if (w.isMinimized && !restoreMinimized) continue;

    if (w.app.bundleId !== null) {
      const existing = poolByBundleId.get(w.app.bundleId);
      if (existing) {
        existing.push(w);
      } else {
        poolByBundleId.set(w.app.bundleId, [w]);
      }
    }

    const existing = poolByName.get(w.app.name);
    if (existing) {
      existing.push(w);
    } else {
      poolByName.set(w.app.name, [w]);
    }
  }

  // Sort each pool once
  for (const [key, pool] of poolByBundleId) {
    poolByBundleId.set(key, sortWindows(pool));
  }
  for (const [key, pool] of poolByName) {
    poolByName.set(key, sortWindows(pool));
  }

  const claimed = new Set<string>();
  const matched: WindowMatchResult[] = [];
  const skipped: WindowSkipResult[] = [];

  for (const rule of rules) {
    const label = appLabel(rule);

    // Find the pool for this rule
    let pool: RuntimeWindow[] | undefined;
    if (rule.app.bundleId !== undefined) {
      pool = poolByBundleId.get(rule.app.bundleId);
    } else if (rule.app.name !== undefined) {
      pool = poolByName.get(rule.app.name);
    }

    if (pool === undefined) {
      const known = (rule.app.bundleId !== undefined && knownBundleIds.has(rule.app.bundleId))
        || (rule.app.name !== undefined && knownNames.has(rule.app.name));
      skipped.push({ ruleId: rule.id, app: label, reason: known ? 'noWindows' : 'appNotRunning' });
      continue;
    }

    if (pool.length === 0) {
      skipped.push({ ruleId: rule.id, app: label, reason: 'noWindows' });
      continue;
    }

    const { match } = rule;

    if (match.kind === 'all') {
      const unclaimed = pool.filter(w => !claimed.has(w.id));
      const limited = rule.limit !== undefined ? unclaimed.slice(0, rule.limit) : unclaimed;
      for (const w of limited) {
        claimed.add(w.id);
        matched.push({ ruleId: rule.id, windowId: w.id, window: w });
      }
      if (limited.length === 0) {
        skipped.push({ ruleId: rule.id, app: label, reason: 'noMatch' });
      }
      continue;
    }

    let candidate: RuntimeWindow | null = null;

    if (match.kind === 'mainWindow') {
      const focused = pool.find(w => w.isFocused && !claimed.has(w.id));
      if (focused) {
        candidate = focused;
      } else {
        const first = pool.find(w => !claimed.has(w.id));
        candidate = first ?? null;
      }
    } else if (match.kind === 'byIndex') {
      const w = pool[match.index];
      if (w !== undefined && !claimed.has(w.id)) {
        candidate = w;
      }
    } else if (match.kind === 'byTitle') {
      const re = new RegExp(match.pattern);
      candidate = pool.find(w => !claimed.has(w.id) && re.test(w.title)) ?? null;
    }

    if (candidate !== null) {
      claimed.add(candidate.id);
      matched.push({ ruleId: rule.id, windowId: candidate.id, window: candidate });
    } else {
      skipped.push({ ruleId: rule.id, app: label, reason: 'noMatch' });
    }
  }

  return { matched, skipped };
}
