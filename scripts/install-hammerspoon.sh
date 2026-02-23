#!/usr/bin/env bash
#
# scripts/install-hammerspoon.sh
#
# Sets up Hammerspoon for use with macos-layouts:
#   - Installs Hammerspoon via Homebrew (if not already installed)
#   - Links the hs CLI to $(brew --prefix)/bin so it is on your PATH
#   - Creates ~/.hammerspoon/init.lua (or updates an existing one)
#     with require("hs.ipc") as the first line

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m"

ok()   { printf "  ${GREEN}✓${NC}  %s\n" "$*"; }
warn() { printf "  ${YELLOW}⚠${NC}  %s\n" "$*"; }
fail() { printf "  ${RED}✗${NC}  %s\n" "$*" >&2; }
step() { printf "\n${BOLD}%s${NC}\n" "$*"; }

# ─── 1. Homebrew ──────────────────────────────────────────────────────────────

step "Checking Homebrew..."
if ! command -v brew &>/dev/null; then
  fail "Homebrew not found. Install it from https://brew.sh, then re-run this script."
  exit 1
fi
ok "Homebrew: $(brew --version | head -1)"

# ─── 2. Hammerspoon ───────────────────────────────────────────────────────────

step "Checking Hammerspoon..."
if brew list --cask hammerspoon &>/dev/null 2>&1; then
  ok "Hammerspoon already installed"
else
  echo "  Installing Hammerspoon..."
  brew install --cask hammerspoon
  ok "Hammerspoon installed"
fi

# ─── 3. hs CLI ────────────────────────────────────────────────────────────────

step "Checking hs CLI..."
HS_APP="/Applications/Hammerspoon.app/Contents/Frameworks/hs/hs"
BREW_BIN="$(brew --prefix)/bin"

if command -v hs &>/dev/null; then
  ok "hs already in PATH: $(command -v hs)"
elif [ -f "$HS_APP" ]; then
  ln -sf "$HS_APP" "$BREW_BIN/hs"
  ok "Linked hs → $BREW_BIN/hs"
else
  warn "Hammerspoon binary not found at expected path."
  warn "Launch Hammerspoon once, then re-run this script."
fi

# ─── 4. ~/.hammerspoon/init.lua ───────────────────────────────────────────────

step "Checking ~/.hammerspoon/init.lua..."
mkdir -p "$HOME/.hammerspoon"
INIT_LUA="$HOME/.hammerspoon/init.lua"
IPC_REQUIRE='require("hs.ipc")'

if [ ! -f "$INIT_LUA" ]; then
  printf '%s\n' "$IPC_REQUIRE" > "$INIT_LUA"
  ok "Created $INIT_LUA"
elif grep -qF "$IPC_REQUIRE" "$INIT_LUA"; then
  ok "init.lua already contains $IPC_REQUIRE"
else
  tmp=$(mktemp)
  { printf '%s\n' "$IPC_REQUIRE"; cat "$INIT_LUA"; } > "$tmp"
  mv "$tmp" "$INIT_LUA"
  ok "Prepended $IPC_REQUIRE to existing init.lua"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────

printf "\n${BOLD}Done!${NC} Next steps:\n"
echo "  1. Open Hammerspoon (or reload config: ctrl+cmd+r in Hammerspoon)"
echo "  2. Grant Accessibility permissions when prompted"
echo "     (System Settings > Privacy & Security > Accessibility)"
echo "  3. Run: layouts compile <name>"
echo "  4. Trigger your hotkey to apply the layout"
echo ""
