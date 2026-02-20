/**
 * @finografic/macos-layout — Runtime types
 *
 * These types define the contract between the TypeScript CLI and
 * the Hammerspoon runtime. All communication is JSON over stdio:
 *
 *   TS → HS: JSON on stdin (layout + options)
 *   HS → TS: JSON on stdout (dump or apply result)
 *
 * The TS side owns validation. Hammerspoon trusts the input shape
 * and focuses on fast, reliable execution.
 */

import type { Rect } from './geometry.types.js';

// ─── Runtime dump (what Hammerspoon sees right now) ──────────────────────────

/** A physical display as reported by Hammerspoon */
export interface RuntimeScreen {
  /** Hammerspoon screen ID (hs.screen:id()) — numeric, but treated as string for safety */
  readonly id: string;

  /** Display name as reported by macOS (e.g. "Built-in Retina Display", "DELL U2723QE") */
  readonly name: string;

  /** Whether this is the built-in laptop display */
  readonly isBuiltin: boolean;

  /** Whether this is the macOS primary display (menu bar, coordinate origin 0,0) */
  readonly isPrimary: boolean;

  /** Usable frame excluding menu bar and Dock (what we normalize against) */
  readonly frame: Rect;

  /** Full frame including menu bar area */
  readonly fullFrame: Rect;

  /** Pixel dimensions of the display (physical resolution) */
  readonly resolution: { readonly w: number; readonly h: number };
}

/** A window as reported by Hammerspoon */
export interface RuntimeWindow {
  /** Hammerspoon window ID (hs.window:id()) */
  readonly id: string;

  /** Owning application */
  readonly app: {
    readonly name: string;
    readonly bundleId: string | null;
    readonly pid: number;
  };

  /** Current window title (informational — not used for matching by default) */
  readonly title: string;

  /** macOS accessibility role (typically "AXWindow") */
  readonly role: string;

  /** Whether this is a "standard" window (not a panel, popover, etc.) */
  readonly isStandard: boolean;

  /** Whether the window is currently minimized to Dock */
  readonly isMinimized: boolean;

  /** Whether this window is the focused window */
  readonly isFocused: boolean;

  /** ID of the screen this window is currently on */
  readonly screenId: string;

  /** Current absolute frame (pixels) */
  readonly frame: Rect;
}

/** Complete runtime state snapshot — returned by `layout dump` */
export interface RuntimeDump {
  readonly timestamp: string;
  readonly screens: readonly RuntimeScreen[];
  readonly windows: readonly RuntimeWindow[];
}

// ─── Apply result (what happened when we applied a layout) ───────────────────

/** A window that was successfully moved/resized */
export interface ApplyMoveResult {
  readonly windowId: string;
  readonly ruleId: string;
  readonly app: string;
  readonly from: Rect;
  readonly to: Rect;
  readonly displayRole: string;
}

/** Reason a rule was skipped (not an error — expected in many cases) */
export type SkipReason =
  | 'appNotRunning'
  | 'noWindows'
  | 'noMatch'
  | 'notStandardWindow'
  | 'minimized'
  | 'displayRoleUnresolved';

/** A rule that was skipped during apply */
export interface ApplySkipResult {
  readonly ruleId: string;
  readonly app: string;
  readonly reason: SkipReason;
}

/** An error that occurred during apply */
export interface ApplyError {
  readonly ruleId?: string;
  readonly message: string;
}

/** Complete result of applying a layout */
export interface ApplyResult {
  /** Overall success — true if no errors occurred */
  readonly ok: boolean;

  /** Timestamp of apply execution */
  readonly timestamp: string;

  /** Which layout was applied */
  readonly layoutName: string;

  /** How display roles were resolved */
  readonly resolvedDisplays: Record<
    string,
    {
      readonly screenId: string;
      readonly screenName: string;
    } | null
  >;

  /** Windows that were moved/resized */
  readonly moved: readonly ApplyMoveResult[];

  /** Rules that were skipped (informational, not errors) */
  readonly skipped: readonly ApplySkipResult[];

  /** Actual errors (permissions, HS failures, etc.) */
  readonly errors: readonly ApplyError[];

  /** Execution time in milliseconds */
  readonly durationMs: number;
}
