# 🖥️ macos-layouts

> Trigger perfect window layouts in macOS

## 📦 Installation

```bash
pnpm add -g @finografic/macos-layouts
```

Or clone and link locally:

```bash
pnpm install && pnpm link --global
```

## 🚀 Usage

```text
layouts <command> [options]

  apply     Apply a saved layout to current windows
  save      Save current window positions as a new layout
  list      List available layouts
  dump      Print current screen and window state from Hammerspoon
  doctor    Check environment (Hammerspoon, permissions, layouts directory)
```

### `apply`

Apply a saved layout by name.

```bash
layouts apply work                # Apply the "work" layout
layouts apply home --dry-run      # Preview what would move
layouts apply home --strict       # Fail if any required rule is skipped
```

| Flag                   | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `--dry-run`            | Preview moves without applying                  |
| `--strict`             | Exit with error if any required rule is skipped |
| `--json`               | Output result as JSON                           |
| `--verbose`            | Show detailed output                            |
| `--timeout-ms <ms>`    | Override window move timeout                    |
| `--layouts-dir <path>` | Use a custom layouts directory                  |
| `--focus <app>`        | Focus a specific app after applying             |

### `save`

Save current window positions as a named layout.

```bash
layouts save work                     # Save current windows as "work" (interactive)
layouts save home --no-interactive    # Save without prompts
layouts save work --include Slack     # Only include Slack
layouts save work --exclude Mail      # Exclude Mail
```

| Flag                   | Description                        |
| ---------------------- | ---------------------------------- |
| `--no-interactive`     | Skip interactive prompts           |
| `--include <app>`      | Include only this app (repeatable) |
| `--exclude <app>`      | Exclude this app (repeatable)      |
| `--json`               | Output result as JSON              |
| `--verbose`            | Show detailed output               |
| `--layouts-dir <path>` | Use a custom layouts directory     |

### `list`

List all saved layouts.

```bash
layouts list           # List available layouts
layouts list --json    # Output as JSON array
```

| Flag                   | Description                       |
| ---------------------- | --------------------------------- |
| `--json`               | Output layout names as JSON array |
| `--layouts-dir <path>` | Use a custom layouts directory    |

### `dump`

Print current screen and window state from Hammerspoon.

```bash
layouts dump                                       # Show screens and windows (human-readable)
layouts dump --json --pretty                       # Pretty-print full JSON snapshot
layouts dump --json --pretty --include-minimized   # Include minimized windows
layouts dump --include-hidden                      # Include non-standard windows
```

| Flag                  | Description                                     |
| --------------------- | ----------------------------------------------- |
| `--json`              | Output as JSON                                  |
| `--pretty`            | Pretty-print JSON (requires `--json`)           |
| `--include-minimized` | Include minimized windows                       |
| `--include-hidden`    | Include non-standard windows (panels, popovers) |
| `--verbose`           | Show detailed output                            |

### `compile`

Compile a saved layout to a self-contained Lua file for direct use in Hammerspoon.
The generated file embeds all layout data and runtime logic — no Node.js required at trigger time.

```bash
layouts compile home                             # Write to ~/.hammerspoon/layouts/home.lua
layouts compile home --output ~/Desktop/home.lua # Write to a custom path
```

| Flag                   | Description                                   |
| ---------------------- | --------------------------------------------- |
| `--output <path>`      | Write to a custom path instead of the default |
| `--layouts-dir <path>` | Use a custom layouts directory                |

After compiling, the `compile` command automatically appends a snippet to `~/.hammerspoon/init.lua`. The full recommended setup:

```lua
hs.window.animationDuration = 0  -- instant window moves (default is 0.2s)

-- layouts: home  (appended automatically by `compile`)
local _mlApply_home_lastRun = 0
local function _mlApply_home()
  local now = hs.timer.secondsSinceEpoch()
  if now - _mlApply_home_lastRun < 2.0 then return end
  _mlApply_home_lastRun = now
  dofile(os.getenv("HOME") .. "/.hammerspoon/layouts/home.lua")
end
hs.hotkey.bind({"cmd","alt"}, "h", _mlApply_home)  -- change key binding as needed
hs.screen.watcher.new(_mlApply_home):start()         -- re-applies when Dock moves/shows/hides
```

The 2-second debounce prevents the screen watcher from re-triggering the layout immediately after it runs (the `dockDisplay` nudge fires a screen-change notification that would otherwise cause a snap-back loop).

> `hs.window.animationDuration = 0` must be added manually.

#### `dockDisplay` option

Layouts can specify which display role the Dock should be on before window positions are applied. This matters because `screen:frame()` (the usable area) is smaller on the display that holds the Dock.

```json
{
  "options": {
    "dockDisplay": "secondary"
  }
}
```

When set, `compile` automatically configures instant Dock animation (no sudo required) and the generated Lua will:

1. Move the mouse to the bottom of that display
2. Toggle Dock autohide (true → false) via AppleScript to force the Dock to reappear on the target display
3. Wait 0.1s for `screen:frame()` to update, then apply window positions

**One-time setup** (done automatically by `compile` when `dockDisplay` is set):

```bash
defaults write com.apple.dock autohide-delay -float 0
defaults write com.apple.dock autohide-time-modifier -float 0
killall Dock
```

### `doctor`

Check environment health — Hammerspoon, IPC, accessibility, and layouts directory.

```bash
layouts doctor         # Check environment
layouts doctor --fix   # Show fix instructions for failed checks
```

| Flag                   | Description                             |
| ---------------------- | --------------------------------------- |
| `--fix`                | Show fix instructions for failed checks |
| `--json`               | Output results as JSON                  |
| `--verbose`            | Show detailed output                    |
| `--layouts-dir <path>` | Use a custom layouts directory          |

## 🔧 Prerequisites

- [Hammerspoon](https://www.hammerspoon.org) installed and running
- `hs` CLI on your `PATH`
- `require("hs.ipc")` added to `~/.hammerspoon/init.lua`
- Accessibility permissions granted to Hammerspoon in **System Settings > Privacy & Security > Accessibility**

Run `layouts doctor` to verify your setup.

## 💻 Development

```bash
pnpm install        # Install dependencies (sets up git hooks)
pnpm dev            # Watch mode
pnpm build          # Build
pnpm test.run       # Tests
pnpm lint           # Lint
```

See [docs/DEVELOPER_WORKFLOW.md](./docs/DEVELOPER_WORKFLOW.md) for the complete workflow.

## 📄 License

MIT &copy; [Justin Rankin](https://github.com/finografic)
