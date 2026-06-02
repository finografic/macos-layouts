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

## Imported from `.claude/handoff.md`

# @finografic/macos-layouts — Handoff

## Project

`@finografic/macos-layouts` — TypeScript CLI (`layouts` binary) for deterministic, portable macOS window layout management. Version 0.6.0.

**Flow V3 (2026-03):** This repo was updated alongside other Finografic CLIs so interactive commands share one **normalized** `src/utils/flow.utils.ts` pattern (`FlowContext`, flag-aware prompts, `-y` / yes-mode gating). The file is **part of this project** at `src/utils/flow.utils.ts` — it is not maintained in a separate dev-folder or external path. The “cross-repo” aspect is that **the same module was introduced or aligned in each repo** (gli, genx, macos-layouts); there is no single checkout outside those repos that acts as canonical source. When the flow API or behavior changes, update each repo’s copy consistently and verify each package builds.

## Architecture

Two-layer system:

- **TypeScript CLI ("brain")** — schema validation, layout definitions, window matching logic, display role resolution, orchestration, configuration, reporting. Compiles to `dist/` via tsdown.
- **Hammerspoon runtime ("hands")** — window enumeration, display enumeration, window move/resize, macOS Accessibility API interaction. Lua module invoked by the CLI.
- **AppleScript bridge (`src/lib/finder-bridge.ts`)** — Finder-only path. macOS no longer exposes Finder via the AX API used by Hammerspoon. Capture runs `osascript` to read Finder window bounds and injects synthetic `RuntimeWindow` entries (`finder-N`) into the dump. Apply dispatches Finder moves via `osascript` instead of Hammerspoon. All other apps use the Hammerspoon path unchanged.

**Flow layer (CLI)** — Commands that need interactive clack prompts and flag parsing use `src/utils/flow.utils.ts`: `parseFlowArgs`, `FlowContext`, and helpers (`promptSelect`, `promptMultiSelect`, `promptConfirm`, etc.). This matches the same file name and API surface as sibling Finografic CLI packages.

Communication: JSON over stdio. TS pipes validated layout JSON to Hammerspoon via `execa('hs', ['-c', ...])`. HS returns structured JSON results on stdout. No temp files, no sockets, no HTTP.

TS owns all validation (StandardSchema v1). Hammerspoon trusts input and focuses on execution.

## Stack

- TypeScript (strict, ESM)
- pnpm, tsdown (build → dist/)
- StandardSchema v1 (validation), execa (subprocess), picocolors (terminal output), @clack/prompts (interactive save flow)
- Hammerspoon (runtime, not a TS dependency)

## Schema / Types

Core types in `src/types/`:

| File                | Types                                                                      | Purpose                                                              |
| ------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `geometry.types.ts` | `Rect`, `NormalizedRect`                                                   | Absolute (px) and normalized (0–1) coordinates                       |
| `display.types.ts`  | `DisplayMatch` (6 variants), `DisplayRole`, `DisplayRoleMap`               | Semantic display targeting with ordered claim-once resolution        |
| `window.types.ts`   | `AppIdentity`, `WindowMatch` (4 variants), `WindowPlacement`, `WindowRule` | Window targeting by bundleId, match strategy, normalized placement   |
| `layout.types.ts`   | `Layout`, `LayoutOptions`                                                  | Top-level layout definition; options include `dockDisplay`, `hotkey` |
| `runtime.types.ts`  | `RuntimeDump`, `RuntimeScreen`, `RuntimeWindow`, `ApplyResult` + subtypes  | HS ↔ TS communication contract                                       |
| `cli.types.ts`      | `ExitCode`, command option types                                           | CLI command options and exit codes                                   |

**Flow (shared module)** — `src/utils/flow.utils.ts`: `FlowContext<F>` (parsed flags, `yesMode`, positional `args`), `FlagDefs`, and prompt helpers with flag integration and yes-mode behavior. Not duplicated in `src/types/`; imported by commands that use the flow pattern (e.g. `save`).

## CLI Commands

| Command                | Description                                           | Status      |
| ---------------------- | ----------------------------------------------------- | ----------- |
| `layouts apply <name>` | Apply saved layout to current windows                 | Implemented |
| `layouts save <name>`  | Snapshot current state → portable layout JSON         | Implemented |
| `layouts list`         | List available layouts                                | Implemented |
| `layouts dump`         | Print current runtime state (screens + windows)       | Implemented |
| `layouts doctor`       | Verify environment (HS, permissions, module)          | Implemented |
| `compile` (internal)   | Compile layout to Lua; called automatically by `save` | Not public  |

Exit codes: 0 success, 1 error, 2 layout invalid, 3 runtime unavailable, 4 permissions.

Public flags are minimal by design: `apply` has `--dry-run`, `--focus`; `save` has `-y/--yes`, `--include`, `--exclude`; `dump` has `--json`, `--pretty`, `--include-minimized`; `doctor` has `--fix`.

`save` uses `FlowContext` from `flow.utils.ts` — `SaveOptions.yes` was removed; yes-mode is `flow.yesMode`. Interactive steps use `promptSelect` / `promptMultiSelect` / `promptConfirm` (and related helpers) instead of raw clack-only wiring where the flow module applies.

## Sibling repos (same Flow V3 normalization)

Work was done by cloning into a dev-folder and aligning patterns across packages — **not** by pointing every repo at a single external `flow.utils.ts` on disk.

| Repo                     | Notes (high level)                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **macos-layouts** (this) | `save.command.ts` on flow; `flow.utils.ts` at `src/utils/`.                                                                                                                                                                                                                                                                                                           |
| **`@finografic/gli`**    | e.g. `dev-flow` branch: `rebase` migrated to flow; `RebaseBranchParams` carries `flow: FlowContext` instead of `yes: boolean`. `--all` initial confirm uses `required: true` — `-y` intentionally does **not** skip it (documented in help). `PrStatus`, `RebaseBranchResult` unchanged in meaning. Other commands (e.g. `gli pr`) not migrated to flow in that pass. |

## Decisions

- **27** Finder windows are handled via a dedicated AppleScript bridge (`finder-bridge.ts`), not Hammerspoon. macOS dropped Finder from the AX API; `osascript` is the only reliable path. Schema is unchanged — Finder entries conform to the same `RuntimeWindow` shape with synthetic `finder-N` IDs, matched by `byIndex`. (2026-04-07)
- **26** `flow.utils.ts` is **in-repo** at `src/utils/flow.utils.ts` in each Finografic CLI that adopted Flow V3. It normalizes the pattern across gli, genx, and macos-layouts; synchronization is manual (same edits / copy) so API and behavior stay aligned — **not** a separate canonical tree outside those repos. (2026-03-27)
- **25** `FlowContext<F>` replaces ad-hoc `yes: boolean` / `options.yes` in migrated commands; flag resolution and yes-mode are centralized. (2026-03-27)
- **24** In **gli** `rebase`, `--all` initial confirm uses `required: true`; `-y` does not skip it (by design). (2026-03-27)
- **23** `compile` removed from public CLI; it runs automatically inside `save` when a hotkey is set. Power users can still call it but it's not documented. (2026-02-26)
- **22** CLI simplified — stripped `--strict`, `--timeout-ms`, `--json`, `--verbose`, `--layouts-dir` from apply; all corresponding flags from other commands. `StrictFailure` exit code removed. (2026-02-26)
- **21** `hotkey` field added to `LayoutOptions` (`{ mods: string[], key: string }`). `save` flow captures hotkey via `hs.eventtap` (live key detection, writes to temp file), pre-fills a `text()` prompt. `compile` generates `hs.hotkey.bind(...)` line. (2026-02-24)
- **20** `dockDisplay` option in `LayoutOptions` — specifies which display role the Dock should be on. `compile` generates Lua to nudge Dock before applying. Apply-time fix: extends frame height by Dock height delta for `dockDisplay` target. (2026-02-24)
- **19** `doctor` checks 6 things in order: hs binary, hs running, IPC loaded, accessibility, layouts dir, screen detection. Checks 1-4 are critical; 5 is warning only. (2026-02-21)
- **18** `save` command uses clack for interactive flow (select per-screen role, multiselect windows, confirm). Non-interactive auto-assigns via `autoAssignRoles()`. (2026-02-21)
- **17** `buildLayout()` assigns roles in order: primary first, builtin second, others alphabetically. Rule IDs are `appslug-N`. (2026-02-21)
- **16** Vitest ESM partial mocking pattern: `vi.mock('...', async (importOriginal) => { const actual = await importOriginal(); return { ...actual, fn: vi.fn() }; })`. (2026-02-21)
- **15** Window sort order is `(x, y)` ascending, then window ID. `byIndex: 0` = leftmost window. (2026-02-21)
- **14** `byIndex` uses absolute indexing into the original full sorted window list per app. (2026-02-21)

## Open Questions

1. **Ghostty duplicate titles** — Two windows with identical titles can't be distinguished by title alone; need `byIndex` fallback or accept same placement via `all`.
2. **Flow / flags (shared pattern)** — Should `--yes` (long form) be registered as an alias for `-y` everywhere flow defs are used? (Some commands may only wire `-y` today.)
3. **gli (sibling)** — Migrate branch select in single-branch mode from raw `clack.select` + `__cancel__` sentinel to `promptSelect`? Other `gli` commands to flow when next touched?

## Status

All 5 public commands implemented and working. Finder window support restored via AppleScript bridge after macOS dropped Finder from the AX API (BUGFIX, 2026-04-07). CLI simplified — low-priority flags removed, `compile` is internal-only. `save` flow captures hotkeys live via Hammerspoon eventtap. `compile` generates self-contained Lua + hotkey binding + screen watcher. 84 tests passing.

Flow framework (`src/utils/flow.utils.ts`) is the **in-repo** shared module for normalized flag parsing and prompt gating. `save.command.ts` is migrated: interactive branch uses flow helpers; `options.yes` → `flow.yesMode`. Next: bump version, publish.
