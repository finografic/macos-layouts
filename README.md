# 🖥️ @finografic/macos-layouts

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
macos-layouts <command> [options]

  apply     Apply a saved layout to current windows
  save      Save current window positions as a new layout
  list      List available layouts
  dump      Print current screen and window state from Hammerspoon
  doctor    Check environment (Hammerspoon, permissions, layouts directory)
```

### `apply`

Apply a saved layout by name.

```bash
macos-layouts apply work                # Apply the "work" layout
macos-layouts apply home --dry-run      # Preview what would move
macos-layouts apply home --strict       # Fail if any required rule is skipped
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
macos-layouts save work                     # Save current windows as "work" (interactive)
macos-layouts save home --no-interactive    # Save without prompts
macos-layouts save work --include Slack     # Only include Slack
macos-layouts save work --exclude Mail      # Exclude Mail
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
macos-layouts list           # List available layouts
macos-layouts list --json    # Output as JSON array
```

| Flag                   | Description                       |
| ---------------------- | --------------------------------- |
| `--json`               | Output layout names as JSON array |
| `--layouts-dir <path>` | Use a custom layouts directory    |

### `dump`

Print current screen and window state from Hammerspoon.

```bash
macos-layouts dump                                       # Show screens and windows (human-readable)
macos-layouts dump --json --pretty                       # Pretty-print full JSON snapshot
macos-layouts dump --json --pretty --include-minimized   # Include minimized windows
macos-layouts dump --include-hidden                      # Include non-standard windows
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
macos-layouts compile home                             # Write to ~/.hammerspoon/layouts/home.lua
macos-layouts compile home --output ~/Desktop/home.lua # Write to a custom path
```

| Flag                   | Description                                   |
| ---------------------- | --------------------------------------------- |
| `--output <path>`      | Write to a custom path instead of the default |
| `--layouts-dir <path>` | Use a custom layouts directory                |

After compiling, add a hotkey to `~/.hammerspoon/init.lua`:

```lua
hs.hotkey.bind({"cmd","alt"}, "h", function()
  dofile(os.getenv("HOME") .. "/.hammerspoon/layouts/home.lua")
end)
```

### `doctor`

Check environment health — Hammerspoon, IPC, accessibility, and layouts directory.

```bash
macos-layouts doctor         # Check environment
macos-layouts doctor --fix   # Show fix instructions for failed checks
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

Run `macos-layouts doctor` to verify your setup.

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
