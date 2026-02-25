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

## 🛠️ Hammerspoon Setup

[Hammerspoon](https://www.hammerspoon.org) is required to read screen state and move windows. Run the setup script to install it and wire up the IPC connection:

```bash
pnpm run setup:hammerspoon
# or: bash scripts/install-hammerspoon.sh
```

This will:

- Install Hammerspoon via Homebrew (if not already installed)
- Link the `hs` CLI into your PATH via `$(brew --prefix)/bin`
- Create `~/.hammerspoon/init.lua` with the required `require("hs.ipc")` line (or prepend it to an existing file)

After running, **open Hammerspoon** and grant Accessibility permissions when prompted (**System Settings > Privacy & Security > Accessibility**).

Run `layouts doctor` to verify your setup.

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
```

| Flag            | Description                         |
| --------------- | ----------------------------------- |
| `--dry-run`     | Preview moves without applying      |
| `--focus <app>` | Focus a specific app after applying |

### `save`

Save current window positions as a named layout.

```bash
layouts save work                     # Save current windows as "work" (interactive)
layouts save work --include Slack     # Only include Slack
layouts save work --exclude Mail      # Exclude Mail
```

| Flag              | Description                        |
| ----------------- | ---------------------------------- |
| `--include <app>` | Include only this app (repeatable) |
| `--exclude <app>` | Exclude this app (repeatable)      |

### `list`

List all saved layouts.

```bash
layouts list
```

### `dump`

Print current screen and window state from Hammerspoon.

```bash
layouts dump                          # Show screens and windows
layouts dump --json --pretty          # Pretty-print full JSON snapshot
```

| Flag                  | Description                           |
| --------------------- | ------------------------------------- |
| `--json`              | Output as JSON                        |
| `--pretty`            | Pretty-print JSON (requires `--json`) |
| `--include-minimized` | Include minimized windows             |

### `doctor`

Check environment health — Hammerspoon, IPC, accessibility, and layouts directory.

```bash
layouts doctor         # Check environment
layouts doctor --fix   # Show fix instructions for failed checks
```

| Flag    | Description                             |
| ------- | --------------------------------------- |
| `--fix` | Show fix instructions for failed checks |

## 📄 License

MIT &copy; [Justin Rankin](https://github.com/finografic)
