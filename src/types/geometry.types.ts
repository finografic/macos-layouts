/**
 * @finografic/macos-layout — Core geometry types
 *
 * All coordinate types used across the system.
 * Two coordinate systems exist:
 *
 * 1. Absolute (pixels) — used in RuntimeDump, Hammerspoon communication
 * 2. Normalized (0–1)  — used in layout definitions, always relative to
 *    the target display's usable frame (screen:frame(), which excludes
 *    menu bar and Dock)
 */

// ─── Absolute (pixel) coordinates ────────────────────────────────────────────

/** Absolute pixel rectangle — used for runtime state and HS communication */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

// ─── Normalized (0–1) coordinates ────────────────────────────────────────────

/**
 * Normalized rectangle relative to a display's usable frame.
 *
 * All values are fractions in the range [0, 1].
 * The usable frame excludes menu bar and Dock — we normalize against
 * screen:frame() so that Dock visibility changes don't invalidate layouts.
 *
 * Examples:
 *   Left 60%:  { x: 0, y: 0, w: 0.6, h: 1 }
 *   Right 40%: { x: 0.6, y: 0, w: 0.4, h: 1 }
 *   Full:      { x: 0, y: 0, w: 1, h: 1 }
 */
export interface NormalizedRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
