/**
 * @finografic/macos-layout — Window matching & placement types
 *
 * Window rules define HOW to find a window and WHERE to put it.
 *
 * Matching hierarchy (preferred → fallback):
 *   1. bundleId (most stable, survives renames)
 *   2. app name (fallback if bundleId unknown)
 *   3. match strategy (which window of that app)
 *   4. optional title regex (explicit opt-in only)
 *
 * Multi-window handling:
 *   Multiple rules can target the same app. Each rule claims one window
 *   (or a set, with kind: "all"). Windows are sorted deterministically
 *   before matching, so slot assignment is stable.
 */

import type { NormalizedRect } from './geometry.js';

// ─── App identity ────────────────────────────────────────────────────────────

/** How to identify which application a rule targets */
export interface AppIdentity {
  /** macOS bundle identifier (preferred). Example: "com.microsoft.VSCode" */
  readonly bundleId?: string;

  /** Application name (fallback). Example: "Code" */
  readonly name?: string;
}

// ─── Window match strategies ─────────────────────────────────────────────────

/**
 * Match the app's "main window" — Hammerspoon's app:mainWindow().
 * This is typically the most recently focused standard window.
 */
export interface WindowMatchMain {
  readonly kind: 'mainWindow';
}

/**
 * Match a window by its deterministic index.
 * Windows are sorted by screen position (top-left to bottom-right)
 * before indexing. Index 0 = first in sort order.
 *
 * Use this for multi-window apps where you want stable slot assignment.
 * Example: VSCode window 0 → left, VSCode window 1 → right
 */
export interface WindowMatchByIndex {
  readonly kind: 'byIndex';
  readonly index: number;
}

/**
 * Match ALL standard windows of the app.
 * Combined with `limit` on the rule to cap how many are placed.
 * All matched windows receive the same placement.
 */
export interface WindowMatchAll {
  readonly kind: 'all';
}

/**
 * Match by window title regex. Explicitly opt-in — titles are unstable.
 * Use only when no other strategy works (e.g. distinguishing Chrome profiles).
 */
export interface WindowMatchByTitle {
  readonly kind: 'byTitle';
  readonly pattern: string;
}

export type WindowMatch =
  | WindowMatchMain
  | WindowMatchByIndex
  | WindowMatchAll
  | WindowMatchByTitle;

// ─── Window placement ────────────────────────────────────────────────────────

/**
 * Where to place a matched window.
 *
 * `display` references a key from the layout's displayRoles map.
 * `rect` is normalized (0–1) relative to the display's usable frame.
 */
export interface WindowPlacement {
  /** Display role name (must exist in the layout's displayRoles) */
  readonly display: string;

  /** Normalized position and size within the display's usable frame */
  readonly rect: NormalizedRect;
}

// ─── Window rule ─────────────────────────────────────────────────────────────

/**
 * A single window placement rule.
 *
 * Rules are processed in declaration order. When multiple rules target
 * the same app, windows are claimed in order — once a window is matched
 * by a rule, it's removed from the pool for subsequent rules.
 *
 * This enables multi-window layouts:
 *   { id: "code-main",   app: { bundleId: "com.microsoft.VSCode" }, match: { kind: "byIndex", index: 0 }, place: { display: "mainExternal", rect: leftHalf } }
 *   { id: "code-second", app: { bundleId: "com.microsoft.VSCode" }, match: { kind: "byIndex", index: 1 }, place: { display: "secondaryExternal", rect: full } }
 */
export interface WindowRule {
  /**
   * Stable identifier for this rule.
   * Used in apply reports and debugging. Must be unique within a layout.
   */
  readonly id: string;

  /** Which application this rule targets */
  readonly app: AppIdentity;

  /** How to select the specific window(s) from that app */
  readonly match: WindowMatch;

  /** Where to place the matched window(s) */
  readonly place: WindowPlacement;

  /**
   * If true, the apply command will warn (or fail in strict mode)
   * when this rule can't be satisfied (app not running, no matching window).
   */
  readonly required?: boolean;

  /**
   * Maximum number of windows to place when match.kind is "all".
   * Ignored for other match kinds.
   */
  readonly limit?: number;

  /**
   * Optional: target macOS Space index (1-based).
   * Requires yabai at runtime. Ignored if yabai is unavailable.
   * Reserved for v2 — included in schema now so layouts are forward-compatible.
   */
  readonly space?: number;
}
