# macos-layouts — Handoff

## Project

`@finografic/macos-layouts` — CLI tool for saving and applying macOS window layouts via
Hammerspoon. Layouts are stored as JSON, compiled to self-contained Lua scripts, and
triggered via hotkey or screen watcher.

## Architecture

```
CLI (cli.ts)
  ↓
commands/
  save.command.ts      — capture current windows → layout JSON
  apply.command.ts     — load layout JSON → move windows
  compile.command.ts   — layout JSON → Lua script
  list/dump/doctor     — informational commands

lib/
  layout-loader.ts     — read/write layout JSON from ~/.config/layout/layouts/
  lua-codegen.ts       — generateLua(): embeds layout data + full runtime logic as Lua
  finder-bridge.ts     — AppleScript fallback for Finder windows (AX API blind spot)
  window-matcher.ts    — pool-based window matching (byIndex, byTitle, mainWindow, all)
  display-resolver.ts  — semantic role → physical screen resolution
  rect-converter.ts    — normalized (0–1) rects → absolute pixels

types/
  layout.types.ts      — Layout, LayoutOptions, DisplayRoleMap, WindowRule
  display.types.ts     — DisplayMatch variants (builtin, primary, largestExternal, …)
  cli.types.ts         — CompileOptions, ApplyOptions, SaveOptions, EXIT_CODE
```

The compiled Lua is fully self-contained — no `require()`, no external files. All
matching and display-resolution logic is embedded inline. `dofile()` in Hammerspoon
is the only runtime dependency.

## Stack

- TypeScript (strict, ESM), pnpm, tsdown (build → `bin/`)
- Hammerspoon (macOS window manager, Lua runtime)
- AppleScript via `osascript` for Finder windows

## Key Finder Quirk

macOS no longer exposes Finder windows via the AX API. Two separate fixes exist:

1. **Node.js path** (`finder-bridge.ts`): `fetchFinderWindows()` + `applyFinderMove()`
   called from `save.command.ts` / `apply.command.ts`.
2. **Compiled Lua path** (`lua-codegen.ts` APPLY_BLOCK): `collectWindows()` calls
   `hs.osascript.applescript` which returns a **Lua table**, not a string.
   Guard must be `type(raw) == "table"` not `type(raw) == "string"`.
   Diagnostic: `ok=true, raw=table: 0x...` means the type check is wrong.

Full details: `docs/finder-window-fix.md`.

## CLI Commands

| Command   | Description                                             | Status |
| --------- | ------------------------------------------------------- | ------ |
| `apply`   | Move windows to match a saved layout                    | ✓      |
| `save`    | Capture current windows as a named layout (interactive) | ✓      |
| `compile` | Regenerate Lua from layout JSON                         | ✓      |
| `list`    | List saved layouts                                      | ✓      |
| `dump`    | Print live screen + window state from Hammerspoon       | ✓      |
| `doctor`  | Check environment (Hammerspoon, IPC, permissions)       | ✓      |

### `compile` flags

| Flag       | Description                                                      |
| ---------- | ---------------------------------------------------------------- |
| `--swap`   | Swap `secondary`<->`tertiary` (or `primary`<->`secondary`) roles |
| `--output` | Write Lua to a custom path                                       |

## Decisions

1. `hs.osascript.applescript` returns native Lua types — never assume string (2026-04-26)
2. `--swap` exchanges role `match` definitions, not window rules (2026-04-26)
3. Finder capture in compiled Lua uses `hs.osascript.applescript` with table-aware parser (2026-04-26)
4. Finder bridge introduced for AX API blind spot — dual-path: HS for all apps, osascript for Finder (2026-04-07)
5. Compiled Lua is fully self-contained — no `require()`, no external runtime files (2026-02-21)
6. `compile` was re-exposed as a public CLI command after being internal-only (2026-04-26)

## Open Questions

_None._

## Status

Stable. Finder window support fully working in both Node.js and compiled Lua paths.
`--swap` flag available on `compile`. All changes committed on `master`.
