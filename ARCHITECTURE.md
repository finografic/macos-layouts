# @finografic/macos-layout — Architecture & Schema Reference (v0.1)

## Mental Model

```
┌─────────────────────────────────────────────────────────────────┐
│  Layout JSON (intent)                                           │
│  "VSCode window 0 → mainExternal, left 62%"                    │
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────────┐  │
│  │ DisplayRoles │───▶│ WindowRules  │───▶│   Placements       │  │
│  │ (who is who) │    │ (find + claim)│   │ (normalized rects) │  │
│  └─────────────┘    └──────────────┘    └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                          │
                   validate (TS)
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Hammerspoon Runtime (execution)                                │
│                                                                 │
│  stdin ← JSON { layout, options }                               │
│  stdout → JSON { ok, moved[], skipped[], errors[] }             │
│                                                                 │
│  1. Enumerate screens + windows                                 │
│  2. Resolve display roles (ordered, claim-once)                 │
│  3. Match windows per rule (ordered, claim-once)                │
│  4. Convert normalized rect → absolute pixels                   │
│  5. Move/resize                                                 │
│  6. Return structured result                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Display roles are resolved in declaration order (claim-once)

Each physical display can satisfy exactly one role. Once claimed, it's
excluded from subsequent matching. This prevents ambiguity with 2+ externals.

```json
{
  "mainExternal": { "match": { "kind": "largestExternal" } },
  "secondaryExternal": { "match": { "kind": "externalByIndex", "index": 0 }, "fallback": "builtin" }
}
```

After `mainExternal` claims the largest external, `externalByIndex: 0` picks
the first _remaining_ external (sorted by area, descending).

### 2. Window rules are processed in declaration order (claim-once)

Multiple rules can target the same app. Windows are sorted deterministically
(top-left → bottom-right by current position), then claimed sequentially.

```json
[
  { "id": "code-main",   "app": { "bundleId": "com.microsoft.VSCode" }, "match": { "kind": "byIndex", "index": 0 }, "place": { ... } },
  { "id": "code-second", "app": { "bundleId": "com.microsoft.VSCode" }, "match": { "kind": "byIndex", "index": 1 }, "place": { ... } }
]
```

Window 0 is claimed by `code-main`, window 1 by `code-second`. Stable, deterministic.

### 3. Normalized coordinates use the usable frame

All rects are 0–1 relative to `screen:frame()` (excludes menu bar + Dock).
This means layouts survive Dock visibility/position changes — macOS handles
the frame adjustment, and our normalization is always against the available space.

### 4. TS owns validation; Hammerspoon trusts input

Schema validation (StandardSchema v1) happens entirely in TypeScript.
Hammerspoon receives pre-validated JSON and executes without re-checking.
Single source of truth for correctness.

### 5. Communication is JSON over stdio

No temp files, no sockets, no HTTP.

```
TS:  execa('hs', ['-c', luaScript])
     └── pipes JSON layout to HS via hs.json.decode(io.read("*a"))
HS:  reads stdin → executes → prints JSON result to stdout
TS:  parses stdout JSON → reports to user
```

Clean, debuggable, no state management.

---

## File Map

```
src/types/
  geometry.ts     — Rect, NormalizedRect
  display.ts      — DisplayMatch variants, DisplayRole, DisplayRoleMap
  window.ts       — AppIdentity, WindowMatch variants, WindowPlacement, WindowRule
  layout.ts       — Layout, LayoutOptions (top-level schema)
  runtime.ts      — RuntimeDump, ApplyResult (HS ↔ TS contract)
  cli.ts          — CLI option types, ExitCode
  index.ts        — barrel exports
```

---

## Schema Changes from Planning Thread

| Thread concept                               | What changed                    | Why                                                                                |
| -------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| `match.kind: "frontmost"`                    | Removed                         | Nondeterministic — depends on focus order at apply time. Use `mainWindow` instead. |
| `match.kind: "any"`                          | Renamed to `byIndex`            | Clearer intent. `any` was confusing when `index` was present.                      |
| `match.kind: "byRole"`                       | Removed                         | `AXWindow` is the only useful value — filtering to standard windows handles this.  |
| `Placement.mode: "maximize"`                 | Removed                         | Ambiguous (macOS fullscreen vs rect {0,0,1,1}). Use rect values directly.          |
| `options.moveMinimizedWindows`               | Renamed to `restoreMinimized`   | Positive naming is clearer.                                                        |
| `options.focusAfterApply.mode`               | Flattened to string union       | Simpler — no nested object needed.                                                 |
| `displayRoles.*.match.kind: "otherExternal"` | Replaced with `externalByIndex` | Scales to 3+ externals without relying on `relativeTo`.                            |
| `RuntimeDump.screens[].resolution`           | Added                           | Needed for accurate pixel-area calculation in display role resolution.             |
| `RuntimeWindow.app.pid`                      | Added                           | Useful for disambiguating multiple instances of same app.                          |
| `ApplyResult.resolvedDisplays`               | Added                           | Critical for debugging — shows how roles mapped to physical displays.              |
| `ApplyResult.durationMs`                     | Added                           | Performance tracking.                                                              |
| `WindowRule.space`                           | Added (reserved)                | Forward-compatible for yabai Spaces support in v2.                                 |

---

## Open Questions for v1

1. **Window sort stability**: If two windows have identical top-left positions
   (overlapping), what's the tiebreaker? Suggestion: fall back to window ID
   (HS-assigned, stable within a session).

2. **Save flow display role detection**: When `layout save` snapshots the current
   state, how should it auto-classify displays into roles? Likely: use the same
   heuristics (builtin detection, area sorting), but confirm with user in
   interactive mode via clack.

3. **Layout file location**: `~/.config/layout/layouts/` is the default, but
   should layouts also be discoverable from the repo (e.g. `.layout/` directory)?
   Useful for project-specific layouts.

4. **Hammerspoon module loading**: The Lua runtime module needs to be
   `require`-able. Options: symlink into HS config dir, or use a known path
   that HS loads on startup. `layout doctor` should verify this.
