# @finografic/macos-layouts — Handoff

## Project

`@finografic/macos-layouts` — TypeScript CLI (`layouts` binary) for deterministic, portable macOS window layout management. Layouts are JSON on disk, compiled to self-contained Lua, triggered via hotkey or screen watcher. Current version: **0.19.3** (see `package.json`).

**Flow V3 (2026-03):** Interactive commands share a normalized `src/utils/flow.utils.ts` (`FlowContext`, flag-aware prompts, `-y` / yes-mode gating). The module lives **in this repo** only — not in a separate dev-folder or external canonical tree. The same file was aligned across sibling Finografic CLIs (gli, genx, macos-layouts); keep copies in sync when the API changes.

## Architecture

**Two layers**

- **TypeScript CLI ("brain")** — validation (StandardSchema v1), layout definitions, window matching, display roles, orchestration, reporting. Built with tsdown → `dist/`.
- **Hammerspoon ("hands")** — window/display enumeration, move/resize via AX. Invoked by CLI; JSON over stdio through `execa('hs', ['-c', ...])`. No temp files, sockets, or HTTP.

**Flow layer** — `src/utils/flow.utils.ts`: `parseFlowArgs`, `FlowContext`, `promptSelect` / `promptMultiSelect` / `promptConfirm`, etc. Used by `save` (and matches sibling CLI packages).

**Finder bridge** — `src/lib/finder-bridge.ts`. macOS no longer exposes Finder via the AX API Hammerspoon uses. Node path: `fetchFinderWindows()` / `applyFinderMove()` from `save` / `apply`. Compiled Lua path: `lua-codegen.ts` APPLY_BLOCK uses `hs.osascript.applescript` (returns a **Lua table**, not a string). Synthetic `finder-N` IDs; schema unchanged.

Compiled Lua is fully self-contained — no `require()`, no external runtime files. All matching and display-resolution logic is embedded inline.

```
CLI (src/cli.ts)
  ↓
commands/
  save / apply / compile / list / dump / doctor

lib/
  layout-loader.ts     — ~/.config/layout/layouts/ JSON
  lua-codegen.ts       — generateLua() + embedded runtime
  finder-bridge.ts     — AppleScript for Finder
  window-matcher.ts    — byIndex, byTitle, mainWindow, all
  display-resolver.ts  — semantic role → screen
  rect-converter.ts    — normalized rects → pixels

types/                 — layout, display, window, runtime, cli, geometry
utils/flow.utils.ts    — shared flow framework (cross-repo pattern)
```

## Stack

- TypeScript (strict, ESM), pnpm, tsdown
- StandardSchema v1, execa, picocolors, @clack/prompts
- Hammerspoon (runtime, not a TS dependency)
- AppleScript via `osascript` for Finder windows

## Key Finder quirk

Two fixes must stay consistent:

1. **Node.js** (`finder-bridge.ts`) — used from `save.command.ts` / `apply.command.ts`.
2. **Compiled Lua** (`lua-codegen.ts`) — `collectWindows()` must treat `hs.osascript.applescript` result as `type(raw) == "table"`, not `"string"`. Diagnostic `ok=true, raw=table: 0x...` with zero Finder windows usually means the type guard is wrong.

Details: `docs/finder-window-fix.md`.

## Schema / Types

| File                | Types                                                                     | Purpose                                    |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------ |
| `geometry.types.ts` | `Rect`, `NormalizedRect`                                                  | Absolute and normalized (0–1) coordinates  |
| `display.types.ts`  | `DisplayMatch` (6 variants), `DisplayRole`, `DisplayRoleMap`              | Semantic display targeting                 |
| `window.types.ts`   | `AppIdentity`, `WindowMatch`, `WindowPlacement`, `WindowRule`             | Window targeting and placement             |
| `layout.types.ts`   | `Layout`, `LayoutOptions`                                                 | Layout definition; `dockDisplay`, `hotkey` |
| `runtime.types.ts`  | `RuntimeDump`, `RuntimeScreen`, `RuntimeWindow`, `ApplyResult` + subtypes | HS ↔ TS contract                           |
| `cli.types.ts`      | `ExitCode`, command option types                                          | CLI options and exit codes                 |

**Flow** — `FlowContext<F>`, `FlagDefs`, prompt helpers; imported by flow-based commands (e.g. `save`). `SaveOptions.yes` removed → `flow.yesMode`.

## CLI Commands

| Command                  | Description                                | Status   |
| ------------------------ | ------------------------------------------ | -------- |
| `layouts apply <name>`   | Apply saved layout                         | ✓        |
| `layouts save <name>`    | Snapshot → layout JSON (interactive; flow) | ✓        |
| `layouts compile <name>` | Regenerate Lua from layout JSON            | ✓ public |
| `layouts list`           | List saved layouts                         | ✓        |
| `layouts dump`           | Live screens + windows from HS             | ✓        |
| `layouts doctor`         | Environment checks                         | ✓        |

**Exit codes:** 0 success, 1 error, 2 layout invalid, 3 runtime unavailable, 4 permissions.

**Notable flags:** `apply` — `--dry-run`, `--focus`; `save` — `-y`/`--yes`, `--include`, `--exclude`; `dump` — `--json`, `--pretty`, `--include-minimized`; `doctor` — `--fix`.

**`compile` flags**

| Flag       | Description                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `--swap`   | Swap `secondary`↔`tertiary`, or `primary`↔`secondary` role **match** definitions (not window rules) |
| `--output` | Write Lua to a custom path                                                                          |

`save` still auto-runs compile when a hotkey is set. `save` uses flow helpers for interactive prompts.

## Sibling repos (Flow V3)

Alignment was done per-repo (`src/utils/flow.utils.ts` in each checkout), not via a shared external file.

| Repo                     | Notes                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **macos-layouts** (this) | `save` on flow.                                                                                                                                                           |
| **`@finografic/gli`**    | e.g. `rebase` on flow; `FlowContext` replaces `yes: boolean`; `--all` initial confirm is `required: true` (`-y` does not skip). Other commands not migrated in that pass. |

## Decisions

- **32** `compile` is a **public** command again with `--swap` and `--output`; `save` still triggers compile when a hotkey is present. (2026-04-26; supersedes Feb “internal-only” note)
- **31** `hs.osascript.applescript` in compiled Lua returns native Lua types — guard with `type(raw) == "table"`, not `"string"`. (2026-04-26)
- **30** `--swap` exchanges display role `match` definitions, not window rules. (2026-04-26)
- **29** Finder in compiled Lua: table-aware parser in APPLY_BLOCK. (2026-04-26)
- **27** Finder via AppleScript bridge (`finder-bridge.ts`), not HS AX; synthetic `finder-N`, `byIndex` matching. (2026-04-07)
- **26** `flow.utils.ts` in-repo per CLI; manual sync across gli / genx / macos-layouts — no external canonical tree. (2026-03-27)
- **25** `FlowContext<F>` centralizes flags and `yesMode`. (2026-03-27)
- **24** **gli** `rebase`: `--all` confirm is `required: true`; `-y` does not skip. (2026-03-27)
- **21–23** Hotkey capture, `dockDisplay`, CLI flag simplification; brief period when `compile` was undocumented/internal (2026-02) before **32**.
- **14–20** `byIndex` semantics, Vitest `importOriginal` mocks, `save` clack flow, `doctor` checks, role assignment order, self-contained Lua. (2026-02-21)

## Open Questions

1. **Ghostty duplicate titles** — identical titles need `byIndex` or `all` placement strategy.
2. **Flow / flags** — register `--yes` as alias for `-y` in all flow defs?
3. **gli (sibling)** — migrate remaining commands / raw `clack.select` to `promptSelect` when touched?

## Status

Stable on `master`. All six commands working. Finder support verified on Node and compiled Lua paths. `compile --swap` shipped. Flow V3 on `save`. **102** tests passing. Next: version bump / publish as needed.
