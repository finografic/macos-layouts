/**
 * @finografic/macos-layout — Layout definition
 *
 * A Layout is the complete, portable description of a workspace arrangement.
 * It contains:
 *   - display role definitions (how to identify monitors)
 *   - window rules (what goes where)
 *   - options (behavior tuning)
 *
 * Layouts are stored as JSON files in ~/.config/layout/layouts/<name>.json
 * and are designed to be version-controlled, shared, and portable across
 * different desk setups.
 */

import type { DisplayRoleMap } from './display.types.js';
import type { WindowRule } from './window.types.js';

// ─── Layout options ──────────────────────────────────────────────────────────

export interface LayoutOptions {
  /**
   * Whether multiple rules can place windows in overlapping positions.
   * When false (default), overlapping placements generate warnings.
   */
  readonly allowOverlap?: boolean;

  /**
   * Whether to attempt to un-minimize windows before placing them.
   * Default: false — minimized windows are skipped with a "minimized" skip reason.
   */
  readonly restoreMinimized?: boolean;

  /**
   * What to focus after applying the layout.
   *   - "none": don't change focus
   *   - "first": focus the first rule's window
   *   - string: focus the window matching this rule id
   */
  readonly focusAfterApply?: 'none' | 'first' | string;
}

// ─── Layout definition ──────────────────────────────────────────────────────

export interface Layout {
  /** Schema version for forward compatibility */
  readonly $schema?: string;

  /** Schema version identifier */
  readonly version: '0.1';

  /** Human-readable layout name (matches filename by convention) */
  readonly name: string;

  /** Optional description of when/where this layout is used */
  readonly description?: string;

  /**
   * Display role definitions, resolved in declaration order.
   * Each role maps a semantic name to a display matcher.
   */
  readonly displayRoles: DisplayRoleMap;

  /**
   * Window placement rules, processed in declaration order.
   * Rules targeting the same app claim windows sequentially.
   */
  readonly windows: readonly WindowRule[];

  /** Behavior options */
  readonly options?: LayoutOptions;
}
