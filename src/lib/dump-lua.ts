/**
 * Self-contained Lua script — no require(), no external files.
 * Runs in the live Hammerspoon instance via `hs -c`.
 * Returns a JSON string matching the RuntimeDump shape.
 *
 * Shared by dump.command.ts and apply.command.ts.
 */
export const DUMP_LUA = `
return (function()
  local focused = hs.window.focusedWindow()
  local focusedId = focused and focused:id() or nil
  local builtinScreen = hs.screen.find("Built%-in")
  local builtinId = builtinScreen and builtinScreen:id() or nil
  local primaryId = hs.screen.primaryScreen():id()

  local screens = {}
  for _, s in ipairs(hs.screen.allScreens()) do
    local f = s:frame()
    local ff = s:fullFrame()
    local mode = s:currentMode()
    table.insert(screens, {
      id = tostring(s:id()),
      name = s:name() or "",
      isBuiltin = (s:id() == builtinId),
      isPrimary = (s:id() == primaryId),
      frame = { x = f.x, y = f.y, w = f.w, h = f.h },
      fullFrame = { x = ff.x, y = ff.y, w = ff.w, h = ff.h },
      resolution = { w = mode and mode.w or ff.w, h = mode and mode.h or ff.h }
    })
  end

  local windows = {}
  for _, w in ipairs(hs.window.allWindows()) do
    local app = w:application()
    local wf = w:frame()
    local ws = w:screen()
    table.insert(windows, {
      id = tostring(w:id()),
      app = {
        name = app and app:name() or "",
        bundleId = app and app:bundleID() or hs.json.NULL,
        pid = app and app:pid() or 0
      },
      title = w:title() or "",
      role = w:role() or "",
      isStandard = w:isStandard(),
      isMinimized = w:isMinimized(),
      isFocused = (w:id() == focusedId),
      screenId = ws and tostring(ws:id()) or "",
      frame = { x = wf.x, y = wf.y, w = wf.w, h = wf.h }
    })
  end

  return hs.json.encode({
    timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ"),
    screens = screens,
    windows = windows
  })
end)()
`.trim();
