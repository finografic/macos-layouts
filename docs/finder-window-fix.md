# Finder Window Support — macOS AX API Regression & Fix

## The Problem

Finder windows stopped appearing in `layouts save` window lists and stopped being
moved by `layouts apply`, silently. No error was thrown — Finder entries in existing
layouts were simply skipped with a `noWindows` reason, as if Finder was not running.

### Root cause

`hs.window.allWindows()` (and `hs.application.get("Finder"):allWindows()`) no longer
return Finder windows on recent macOS releases. The macOS Accessibility (AX) API —
which Hammerspoon uses exclusively — no longer exposes Finder windows to the AX
subsystem. This is an upstream macOS behavioral change, not a bug in this codebase.

Third-party tools that rely on the same AX path (e.g. BetterTouchTool) exhibit
identical behavior.

### Why AppleScript still works

AppleScript talks to Finder via a separate scripting bridge (`tell application "Finder"
...`) that bypasses the AX API entirely. Apple continues to support this path, so
window bounds can be read and set through it.

---

## The Fix

A dual-path engine was introduced. Normal apps continue to use Hammerspoon (no change).
Finder is handled exclusively via `osascript`.

| Phase   | Normal apps       | Finder                |
| ------- | ----------------- | --------------------- |
| Capture | Hammerspoon (Lua) | `osascript` (capture) |
| Apply   | Hammerspoon (Lua) | `osascript` (apply)   |

---

## Implementation

### New module: `src/lib/finder-bridge.ts`

Two exported functions:

**`fetchFinderWindows(screens)`**

Runs:

```bash
osascript -e 'tell application "Finder" to get bounds of every window'
```

Parses the `{left, top, right, bottom}` output and converts each entry into a standard
`RuntimeWindow` object. Window IDs are synthetic: `finder-0`, `finder-1`, etc. (0-based,
matching the order AppleScript returns them). `screenId` is assigned by checking which
screen's `fullFrame` contains the window center. Returns `[]` silently if Finder is not
running or has no windows.

**`applyFinderMove(windowId, frame, before)`**

Extracts the 0-based index from `finder-N`, adds 1 for AppleScript's 1-based window
index, and runs:

```bash
osascript -e 'tell application "Finder" to set bounds of window N to {left, top, right, bottom}'
```

Returns a result record compatible with the existing `HsMoveResult` shape used in
`apply.command.ts`.

### Capture augmentation (`save.command.ts`, `apply.command.ts`)

After `hs.dump()` in both commands, `fetchFinderWindows()` is called and its results
are appended to `dump.windows` before any downstream logic runs. The window-matcher
then sees Finder windows as ordinary entries and matches them by `bundleId` +
`byIndex` — the same path as all other apps.

### Apply dispatch (`apply.command.ts`)

Planned moves are split on `bundleId === 'com.apple.finder'` before execution:

```
finderPlanned → applyFinderMove() (AppleScript)
hsPlanned     → buildApplyLua()   (Hammerspoon)
```

Results are merged into the same `allMoveResults` array used by the reporting step.
No changes to output format, exit codes, or summary display.

---

## Constraints upheld

- **Schema unchanged** — Finder window entries in layout JSON use the exact same shape
  as all other windows. No new fields, no special-case variants.
- **Hammerspoon path unmodified** — All non-Finder logic is identical to before.
- **User-facing behavior identical** — `layouts save` and `layouts apply` produce the
  same TUI, same output format, same timing. Finder windows simply appear where they
  were previously missing.
- **Index-based identity** — Finder windows have no stable AX identity. They are
  matched and applied by index only (`byIndex`), which aligns with AppleScript's
  own 1-based window ordering.
- **Silent fallback** — If Finder is not running or has no windows, `fetchFinderWindows`
  returns `[]` and nothing changes. No error is surfaced.
