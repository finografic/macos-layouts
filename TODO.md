# TODO

Future work, roughly in priority order.

---

## Multi-resolution / office display support

**Context:** Current layouts are saved for a specific display setup (Mac Studio + 2× 4K LG externals). The office setup uses 1080p displays with different resolutions.

**Approach:** Layouts can have multiple `displayRoles` with different `match` strategies. A 1080p display would be matched by `byName` or a new `byResolution` matcher. The likely path is saving separate layout files per setup (e.g. `home.json`, `office.json`) with the same window structure but different `displayRoles`.

**Open question:** Should there be a `byResolution` matcher (e.g. `{ kind: "byResolution", width: 1920, height: 1080 }`) to make layouts portable without knowing the display name?

---

## 3-display setup (laptop + 2 externals)

**Context:** When the laptop is connected alongside two external monitors, there are 3 displays. The current `primary` / `secondary` role pair only covers 2.

**Approach:**

- Add a third role (e.g. `builtin` or `laptop`) using `{ kind: "builtin" }` matcher
- The `builtin` matcher is already implemented in the display resolver
- Save a separate layout variant for the 3-display setup
- The Dock should still target `secondary` (the main external) in this setup

**Open question:** Should the compiled Lua handle the 3rd display gracefully when it's absent (laptop lid closed)? Currently unresolved roles are silently skipped — this is already correct behaviour.

---

## Vertical / rotated screens

**Context:** Some desk setups include a vertically rotated monitor.

**Recommendation:** Rotate manually in **System Settings > Displays**, then save the layout. Hammerspoon's `screen:frame()` returns the correct dimensions after rotation (e.g. `w=1080, h=1920`), so the normalised rect system handles it transparently — no special layout support needed.

**Note:** Programmatic screen rotation has no public macOS API. Private-API approaches (e.g. `displayplacer`, CoreGraphics rotation) are unreliable and not recommended — macOS does not always fully register the change without a manual interaction.

---

## Spaces / Desktops support

**Apple terminology:** "Spaces" (the underlying system; visible in Mission Control). The UI labels them "Desktop 1", "Desktop 2", etc.

**Context:** The `WindowRule` type already has a reserved `space?: number` field (1-based) for forward compatibility.

**Goal:** Place specific apps on specific Spaces (e.g. GitHub Desktop on Desktop 2, Obsidian on Desktop 3 of the secondary display), then save that as part of the layout.

**Challenges:**

- Requires `hs.spaces` module (Hammerspoon), which needs accessibility permissions
- Space indices are not stable — they change when Spaces are added, removed, or reordered by the user
- Moving a window to a Space the user hasn't created yet requires creating it first
- Applying a layout with Space assignments on a machine with fewer Spaces than expected needs a fallback strategy

**Likely approach:**

1. During `save`, capture the Space index of each window via `hs.spaces.windowSpaces(win)`
2. Emit `space` in the `WindowRule` JSON
3. During compiled Lua apply, use `hs.spaces.moveWindowToSpace(win, spaceId)` after `setFrame()`
4. Add a pre-flight check: if target Space doesn't exist, skip gracefully (not a hard failure)

---

## Screen watcher debounce tuning

The current debounce is 2.0 seconds (in `init.lua` and `buildInitSnippet`). This is conservative. If the `dockDisplay` nudge + apply completes in ~0.3s total, a tighter debounce (e.g. 1.0s) would be safe and would allow legitimate screen-change re-triggers sooner. Consider exposing this as a layout option.

---

## `dockDisplay` — 40/48px dock gap

**Status: working correctly, no action needed.**

Normalised rects are saved relative to `screen:frame()` (usable area, excluding Dock) at save time. If the Dock was on the secondary display at save time, `h` values in the JSON will be slightly less than `1.0` to leave room for it. The `nudgeDock` mechanism ensures the Dock is on the correct display _before_ `screen:frame()` is read during apply — so the frame dimensions match what was saved, and windows fill the space exactly.
