/**
 * Finder window bridge — AppleScript fallback for Finder windows.
 *
 * MacOS no longer exposes Finder windows via the Accessibility (AX) APIs used by Hammerspoon. This module
 * handles Finder capture and apply exclusively via `osascript`, leaving all non-Finder paths unchanged.
 *
 * Capture: `osascript -e 'tell application "Finder" to get bounds of every window'` Apply: `osascript -e
 * 'tell application "Finder" to set bounds of window N to {...}'`
 */

import { execa } from 'execa';
import type { Rect } from '../types/geometry.types.js';
import type { RuntimeScreen, RuntimeWindow } from '../types/runtime.types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const FINDER_BUNDLE_ID = 'com.apple.finder';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse the AppleScript bounds output. Format: `{left, top, right, bottom}, {left, top, right, bottom}, ...`
 */
function parseBoundsOutput(raw: string): Array<{ left: number; top: number; right: number; bottom: number }> {
  const result: Array<{ left: number; top: number; right: number; bottom: number }> = [];
  const re = /\{\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    result.push({
      left: parseInt(m[1]!, 10),
      top: parseInt(m[2]!, 10),
      right: parseInt(m[3]!, 10),
      bottom: parseInt(m[4]!, 10),
    });
  }
  return result;
}

/** Return the screen ID whose fullFrame contains the window center. Falls back to primary. */
function screenForFrame(frame: Rect, screens: readonly RuntimeScreen[]): string {
  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  for (const screen of screens) {
    const ff = screen.fullFrame;
    if (cx >= ff.x && cx < ff.x + ff.w && cy >= ff.y && cy < ff.y + ff.h) {
      return screen.id;
    }
  }
  return screens.find((s) => s.isPrimary)?.id ?? screens[0]?.id ?? '';
}

// ─── Capture ──────────────────────────────────────────────────────────────────

/**
 * Fetch all open (non-minimized) Finder windows via AppleScript. Returns an empty array if Finder is not
 * running or has no windows. Window IDs are synthetic: `finder-0`, `finder-1`, etc. (0-based).
 */
export async function fetchFinderWindows(screens: readonly RuntimeScreen[]): Promise<RuntimeWindow[]> {
  let raw: string;
  try {
    const { stdout } = await execa(
      'osascript',
      ['-e', 'tell application "Finder" to get bounds of every window'],
      { timeout: 5_000, stripFinalNewline: true },
    );
    raw = stdout;
  } catch {
    return [];
  }

  const bounds = parseBoundsOutput(raw);
  return bounds.map((b, i) => {
    const frame: Rect = { x: b.left, y: b.top, w: b.right - b.left, h: b.bottom - b.top };
    return {
      id: `finder-${i}`,
      app: { name: 'Finder', bundleId: FINDER_BUNDLE_ID, pid: 0 },
      title: '',
      role: 'AXWindow',
      isStandard: true,
      isMinimized: false,
      isFocused: false,
      screenId: screenForFrame(frame, screens),
      frame,
    } satisfies RuntimeWindow;
  });
}

// ─── Apply ────────────────────────────────────────────────────────────────────

export interface FinderMoveResult {
  readonly windowId: string;
  readonly applied: boolean;
  readonly before?: Rect;
  readonly after?: Rect;
  readonly error?: string;
}

/**
 * Move a Finder window via AppleScript.
 *
 * `windowId` must be a synthetic `finder-N` ID (0-based). AppleScript uses 1-based window indexing. `before`
 * is the frame captured during dump, used for the result record.
 */
export async function applyFinderMove(
  windowId: string,
  frame: Rect,
  before: Rect,
): Promise<FinderMoveResult> {
  const match = /^finder-(\d+)$/.exec(windowId);
  if (!match) {
    return { windowId, applied: false, error: `Invalid Finder window ID: ${windowId}` };
  }

  const n = parseInt(match[1]!, 10) + 1; // AppleScript is 1-based
  const { x, y, w, h } = frame;

  try {
    await execa(
      'osascript',
      ['-e', `tell application "Finder" to set bounds of window ${n} to {${x}, ${y}, ${x + w}, ${y + h}}`],
      { timeout: 5_000 },
    );
    return { windowId, applied: true, before, after: frame };
  } catch (err) {
    return {
      windowId,
      applied: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
