# Finder Window Support — macOS AX API Regression & Fix

---

## Bug 1: Finder windows invisible to Hammerspoon

### What happened (human terms)

Finder windows vanished from `layouts save` and `layouts apply` — silently, no error,
no warning. They just stopped appearing, as if Finder wasn't open.

The reason: macOS quietly removed Finder from the list of apps that expose their windows
through the Accessibility (AX) system. Hammerspoon reads windows exclusively through
that system. So from Hammerspoon's point of view, Finder has no windows at all.

This is not a bug in this codebase. Apple changed the OS. Other tools that use the same
AX path (BetterTouchTool, etc.) are broken the same way.

AppleScript uses a completely different channel — a dedicated scripting bridge built
into Finder itself — which Apple still supports. So `osascript` can see and move Finder
windows even though Hammerspoon cannot.

### What happened (agent terms)

- `hs.window.allWindows()` and `hs.application:allWindows()` use the macOS AX API.
- Apple no longer registers Finder windows with the AX subsystem on recent macOS releases.
- Result: all Hammerspoon window enumeration APIs return an empty list for Finder.
- AppleScript (`tell application "Finder" to get bounds of every window`) uses a
  separate IPC channel (the OSA scripting bridge) that is unaffected.
- Fix: bypass Hammerspoon entirely for Finder. Use `osascript` for both capture and apply.

### The fix

A dual-path engine was introduced. Normal apps continue to use Hammerspoon (no change).
Finder is handled exclusively via `osascript`.

| Phase   | Normal apps       | Finder                |
| ------- | ----------------- | --------------------- |
| Capture | Hammerspoon (Lua) | `osascript` (capture) |
| Apply   | Hammerspoon (Lua) | `osascript` (apply)   |

### Implementation

**New module: `src/lib/finder-bridge.ts`**

`fetchFinderWindows(screens)` runs:

```bash
osascript -e 'tell application "Finder" to get bounds of every window'
```

Parses the `{left, top, right, bottom}` output and converts each entry into a standard
`RuntimeWindow` object. Window IDs are synthetic: `finder-1`, `finder-2`, etc. (1-based,
matching AppleScript's own window indexing). Returns `[]` silently if Finder is not
running or has no windows.

`applyFinderMove(windowId, frame, before)` extracts the index from `finder-N` and runs:

```bash
osascript -e 'tell application "Finder" to set bounds of window N to {left, top, right, bottom}'
```

**In `save.command.ts` and `apply.command.ts`:** after `hs.dump()`, `fetchFinderWindows()`
results are appended to `dump.windows` before matching. The window-matcher sees Finder
windows as ordinary entries.

**In `apply.command.ts`:** planned moves are split on `bundleId === 'com.apple.finder'`
before execution — Finder moves go through `applyFinderMove()`, everything else through
Hammerspoon. Results merge back into the same reporting array.

### Constraints upheld

- Schema unchanged — Finder entries use the same `RuntimeWindow` shape as all other apps.
- Hammerspoon path unmodified — all non-Finder logic is identical to before.
- Index-based identity — Finder windows have no stable AX ID; they are matched by index,
  which aligns with AppleScript's own 1-based window ordering.
- Silent fallback — if Finder is not running, `fetchFinderWindows` returns `[]` and
  nothing changes.

---

## Bug 2: Compiled Lua path silently skipped Finder (Hammerspoon type coercion)

### What happened (human terms)

After the Node.js fix above, the compiled `.lua` path (used by the dofile hotkey and
screen watcher) still did not move Finder windows. The console showed `ok=true` — so
AppleScript ran fine and returned data — but the data was thrown away and Finder was
never moved.

The trap: we assumed that calling AppleScript from inside Hammerspoon would return a
string, because that's what `osascript` prints in the terminal. It does not.
Hammerspoon runs AppleScript through Apple's `NSAppleScript` API and **converts the
result to a native Lua value automatically**. A list of bounds comes back as a Lua
table of tables, not a string. The code checked `type(raw) == "string"`, got `false`,
and silently fell through to the "failed" branch — every single time.

The confusing part: running the exact same AppleScript in the terminal (`osascript -e`)
or via `hs -c` both print strings and appear to work. The bug only surfaces inside
a `dofile`'d Lua script, where `hs.osascript.applescript` does the type conversion
automatically.

### What happened (agent terms)

- `hs.osascript.applescript(script)` returns `ok, result, descriptor`.
- `result` is converted to a native Lua type by Hammerspoon, not left as a string.
- `tell application "Finder" to get bounds of every window` returns an AppleScript
  list of lists → Hammerspoon converts it to a Lua table of tables.
- The generated Lua code checked `type(raw) == "string"` — always `false` for list
  results — so the entire Finder capture block was silently skipped.
- `osascript -e` (CLI) and `hs -c` both surface results as stdout strings; this masked
  the bug during terminal testing.
- **Rule for agents:** never assume `hs.osascript.applescript` returns a string.
  Always branch on `type(raw)`. A list AppleScript result is a Lua table, not a string.

### Diagnostic output that reveals this bug

```
[macos-layouts][finder] get bounds failed/empty (ok=true, raw=table: 0x8c1cdc100)
```

`ok=true` with `raw=table:` is the signature of this exact failure. The AppleScript
succeeded; the type check discarded the result.

### The fix (`src/lib/lua-codegen.ts` — `APPLY_BLOCK`)

```lua
-- Before (broken):
if ok and type(raw) == "string" and raw ~= "" then

-- After (fixed):
if ok and raw ~= nil and raw ~= "" then
  local nums = {}
  if type(raw) == "string" then
    for n in raw:gmatch("-?%d+") do table.insert(nums, tonumber(n)) end
  elseif type(raw) == "table" then
    -- hs.osascript.applescript returns {{l,t,r,b}, {l,t,r,b}, ...}
    if type(raw[1]) == "table" then
      for _, quad in ipairs(raw) do
        for _, v in ipairs(quad) do table.insert(nums, tonumber(v)) end
      end
    else
      for _, v in ipairs(raw) do table.insert(nums, tonumber(v)) end
    end
  end
```

### Confirmed working output

```
[macos-layouts][finder] bounds raw (table, #=2)
[macos-layouts][finder] parsed numbers: 8
[macos-layouts][finder] captured finder window index=1 id=43624 frame={-3331,682,-2051,1377}
[macos-layouts][finder] captured finder window index=2 id=42941 frame={-3840,1418,-2560,2113}
[macos-layouts][finder] move by id=42941 -> ok=true raw=table: 0x8c18fcd00
[macos-layouts][finder] move by id=43624 -> ok=true raw=table: 0x8c18fcbc0
```

### Key rule (applies everywhere in this codebase)

`hs.osascript.applescript` is not a thin wrapper around the `osascript` CLI. It uses
`NSAppleScript` internally. AppleScript lists → Lua tables. AppleScript records →
Lua tables. AppleScript strings → Lua strings. Never assume the return type is a string
without checking. Always branch on `type(result)`.
