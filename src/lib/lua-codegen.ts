import type { DisplayMatch, DisplayRoleMap } from '../types/display.types.js';
import type { Layout } from '../types/layout.types.js';
import type { WindowMatch, WindowRule } from '../types/window.types.js';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GenerateLuaParams {
  readonly layout: Layout;
  readonly generatedAt?: Date;
}

/**
 * Generates a self-contained Lua script that applies the given layout
 * when loaded via dofile() in Hammerspoon. No require() or external
 * files are needed — all layout data and runtime logic is embedded inline.
 *
 * The generated file mirrors the behaviour of the Node.js apply command:
 *   - display roles resolved in declaration order (display-resolver.ts)
 *   - windows sorted by (frame.x, frame.y, id) before matching (window-matcher.ts)
 *   - normalized rects converted to absolute pixels via Math.round (rect-converter.ts)
 *
 * Typical usage in Hammerspoon init.lua:
 *   hs.hotkey.bind({"cmd","alt"}, "h", function()
 *     dofile(os.getenv("HOME") .. "/.hammerspoon/layouts/home.lua")
 *   end)
 */
export function generateLua({ layout, generatedAt = new Date() }: GenerateLuaParams): string {
  const date = generatedAt.toISOString().split('T')[0];
  const restoreMinimized = layout.options?.restoreMinimized ?? false;
  const focusAfterApply = layout.options?.focusAfterApply;
  const dockDisplay = layout.options?.dockDisplay;

  const parts: string[] = [
    buildFileHeader(layout.name, date),
    buildLayoutDataBlock(layout, restoreMinimized, focusAfterApply, dockDisplay),
    RESOLVE_DISPLAY_ROLES_FN,
    MATCH_WINDOWS_FN,
    APPLY_BLOCK,
  ];

  return parts.join('\n\n') + '\n';
}

// ─── Lua value serializers ────────────────────────────────────────────────────

function luaString(s: string): string {
  return (
    '"'
    + s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
    + '"'
  );
}

function serializeDisplayMatch(match: DisplayMatch): string {
  switch (match.kind) {
    case 'builtin':
      return '{ kind = "builtin" }';
    case 'primary':
      return '{ kind = "primary" }';
    case 'largestExternal':
      return '{ kind = "largestExternal" }';
    case 'smallestExternal':
      return '{ kind = "smallestExternal" }';
    case 'externalByIndex':
      return `{ kind = "externalByIndex", index = ${match.index} }`;
    case 'byName':
      return `{ kind = "byName", name = ${luaString(match.name)} }`;
  }
}

function serializeWindowMatch(match: WindowMatch): string {
  switch (match.kind) {
    case 'mainWindow':
      return '{ kind = "mainWindow" }';
    case 'byIndex':
      return `{ kind = "byIndex", index = ${match.index} }`;
    case 'all':
      return '{ kind = "all" }';
    case 'byTitle':
      return `{ kind = "byTitle", pattern = ${luaString(match.pattern)} }`;
  }
}

// ─── Table block builders ─────────────────────────────────────────────────────

function buildDisplayRolesTable(displayRoles: DisplayRoleMap): string {
  const lines: string[] = ['  displayRoles = {'];
  for (const [roleName, role] of Object.entries(displayRoles)) {
    const matchPart = serializeDisplayMatch(role.match);
    const fallbackPart = role.fallback !== undefined
      ? `, fallback = ${luaString(role.fallback)}`
      : '';
    lines.push(`    { role = ${luaString(roleName)}, match = ${matchPart}${fallbackPart} },`);
  }
  lines.push('  },');
  return lines.join('\n');
}

function buildWindowRulesTable(rules: readonly WindowRule[]): string {
  const lines: string[] = ['  windows = {'];
  for (const rule of rules) {
    const appParts: string[] = [];
    if (rule.app.bundleId !== undefined) {
      appParts.push(`bundleId = ${luaString(rule.app.bundleId)}`);
    }
    if (rule.app.name !== undefined) appParts.push(`name = ${luaString(rule.app.name)}`);
    const rect = rule.place.rect;
    lines.push('    {');
    lines.push(`      id = ${luaString(rule.id)},`);
    lines.push(`      app = { ${appParts.join(', ')} },`);
    lines.push(`      match = ${serializeWindowMatch(rule.match)},`);
    lines.push(
      `      place = { display = ${
        luaString(rule.place.display)
      }, rect = { x = ${rect.x}, y = ${rect.y}, w = ${rect.w}, h = ${rect.h} } },`,
    );
    if (rule.limit !== undefined) lines.push(`      limit = ${rule.limit},`);
    lines.push('    },');
  }
  lines.push('  },');
  return lines.join('\n');
}

function buildFileHeader(name: string, date: string): string {
  return `-- macos-layouts: compiled layout "${name}"
-- Generated: ${date}
--
-- Usage in Hammerspoon init.lua:
--   hs.hotkey.bind({"cmd","alt"}, "h", function()
--     dofile(os.getenv("HOME") .. "/.hammerspoon/layouts/${name}.lua")
--   end)`;
}

function buildLayoutDataBlock(
  layout: Layout,
  restoreMinimized: boolean,
  focusAfterApply: string | undefined,
  dockDisplay: string | undefined,
): string {
  const displayRolesTable = buildDisplayRolesTable(layout.displayRoles);
  const windowRulesTable = buildWindowRulesTable(layout.windows);
  const focusPart = focusAfterApply !== undefined
    ? `, focusAfterApply = ${luaString(focusAfterApply)}`
    : '';
  const dockDisplayPart = dockDisplay !== undefined
    ? `, dockDisplay = ${luaString(dockDisplay)}`
    : '';

  return [
    `local LAYOUT = {`,
    `  name = ${luaString(layout.name)},`,
    displayRolesTable,
    windowRulesTable,
    `  options = { restoreMinimized = ${restoreMinimized}${focusPart}${dockDisplayPart} },`,
    `}`,
  ].join('\n');
}

// ─── Static Lua function blocks ───────────────────────────────────────────────

/**
 * Mirrors display-resolver.ts: resolves semantic role names to physical screens.
 * Roles are resolved in declaration order; each screen can satisfy at most one role.
 */
const RESOLVE_DISPLAY_ROLES_FN = `\
-- [[ Display role resolver ]]
local function resolveDisplayRoles(roles, screens)
  local resolved = {}
  local pool = {}
  for _, screen in ipairs(screens) do table.insert(pool, screen) end

  local function screenArea(screen)
    return screen.fullFrame.w * screen.fullFrame.h
  end

  local function matchScreen(matchSpec, remainingPool)
    local kind = matchSpec.kind
    if kind == "builtin" then
      for i, screen in ipairs(remainingPool) do
        if screen.isBuiltin then return screen, i end
      end
    elseif kind == "primary" then
      for i, screen in ipairs(remainingPool) do
        if screen.isPrimary then return screen, i end
      end
    elseif kind == "largestExternal" then
      local best, bestIndex, bestArea = nil, nil, -1
      for i, screen in ipairs(remainingPool) do
        if not screen.isBuiltin then
          local area = screenArea(screen)
          if area > bestArea then best, bestIndex, bestArea = screen, i, area end
        end
      end
      return best, bestIndex
    elseif kind == "smallestExternal" then
      local best, bestIndex, bestArea = nil, nil, math.huge
      for i, screen in ipairs(remainingPool) do
        if not screen.isBuiltin then
          local area = screenArea(screen)
          if area <= bestArea then best, bestIndex, bestArea = screen, i, area end
        end
      end
      return best, bestIndex
    elseif kind == "externalByIndex" then
      local externals = {}
      for _, screen in ipairs(remainingPool) do
        if not screen.isBuiltin then table.insert(externals, screen) end
      end
      table.sort(externals, function(a, b) return screenArea(a) > screenArea(b) end)
      local target = externals[matchSpec.index + 1]
      if target then
        for i, screen in ipairs(remainingPool) do
          if screen == target then return screen, i end
        end
      end
    elseif kind == "byName" then
      for i, screen in ipairs(remainingPool) do
        if screen.name:find(matchSpec.name, 1, true) then return screen, i end
      end
    end
    return nil, nil
  end

  for _, entry in ipairs(roles) do
    local roleName = entry.role
    local matched, matchedIndex = matchScreen(entry.match, pool)
    if matched then
      table.remove(pool, matchedIndex)
      resolved[roleName] = matched
    elseif entry.fallback then
      resolved[roleName] = resolved[entry.fallback]
    else
      resolved[roleName] = nil
    end
  end

  return resolved
end`;

/**
 * Mirrors window-matcher.ts: pool-based matching with deterministic sort.
 * Windows are sorted by (frame.x, frame.y, id) before index-based rules are applied.
 * Each window can be claimed by at most one rule.
 *
 * Note: byTitle uses Lua string patterns, which are similar to but not identical
 * to JavaScript regex. Basic patterns (^, $, ., *, +) work the same way.
 */
const MATCH_WINDOWS_FN = `\
-- [[ Window matcher ]]
local function matchWindows(rules, windows, resolvedDisplays)
  local function sortedPool(pool)
    local sorted = {}
    for _, w in ipairs(pool) do table.insert(sorted, w) end
    table.sort(sorted, function(a, b)
      if a.frame.x ~= b.frame.x then return a.frame.x < b.frame.x end
      if a.frame.y ~= b.frame.y then return a.frame.y < b.frame.y end
      return a.id < b.id
    end)
    return sorted
  end

  local function round(n) return math.floor(n + 0.5) end

  local function normalizedToAbsolute(rect, frame)
    return {
      x = round(frame.x + rect.x * frame.w),
      y = round(frame.y + rect.y * frame.h),
      w = round(rect.w * frame.w),
      h = round(rect.h * frame.h),
    }
  end

  local poolByBundleId = {}
  local poolByName = {}
  for _, w in ipairs(windows) do
    if w.app.bundleId then
      if not poolByBundleId[w.app.bundleId] then poolByBundleId[w.app.bundleId] = {} end
      table.insert(poolByBundleId[w.app.bundleId], w)
    end
    if w.app.name and w.app.name ~= "" then
      if not poolByName[w.app.name] then poolByName[w.app.name] = {} end
      table.insert(poolByName[w.app.name], w)
    end
  end
  for key, pool in pairs(poolByBundleId) do poolByBundleId[key] = sortedPool(pool) end
  for key, pool in pairs(poolByName) do poolByName[key] = sortedPool(pool) end

  local claimed = {}
  local moves = {}

  for _, rule in ipairs(rules) do
    local pool = nil
    if rule.app.bundleId then
      pool = poolByBundleId[rule.app.bundleId]
    elseif rule.app.name then
      pool = poolByName[rule.app.name]
    end

    if pool and #pool > 0 then
      local screen = resolvedDisplays[rule.place.display]
      if screen then
        local matchKind = rule.match.kind

        if matchKind == "all" then
          local count = 0
          for _, w in ipairs(pool) do
            if not claimed[w.id] and (not rule.limit or count < rule.limit) then
              claimed[w.id] = true
              table.insert(moves, {
                window = w._window,
                frame = normalizedToAbsolute(rule.place.rect, screen.frame),
                ruleId = rule.id,
              })
              count = count + 1
            end
          end

        elseif matchKind == "mainWindow" then
          local candidate = nil
          for _, w in ipairs(pool) do
            if not claimed[w.id] and w.isFocused then candidate = w; break end
          end
          if not candidate then
            for _, w in ipairs(pool) do
              if not claimed[w.id] then candidate = w; break end
            end
          end
          if candidate then
            claimed[candidate.id] = true
            table.insert(moves, {
              window = candidate._window,
              frame = normalizedToAbsolute(rule.place.rect, screen.frame),
              ruleId = rule.id,
            })
          end

        elseif matchKind == "byIndex" then
          local w = pool[rule.match.index + 1]
          if w and not claimed[w.id] then
            claimed[w.id] = true
            table.insert(moves, {
              window = w._window,
              frame = normalizedToAbsolute(rule.place.rect, screen.frame),
              ruleId = rule.id,
            })
          end

        elseif matchKind == "byTitle" then
          for _, w in ipairs(pool) do
            if not claimed[w.id] and w.title:match(rule.match.pattern) then
              claimed[w.id] = true
              table.insert(moves, {
                window = w._window,
                frame = normalizedToAbsolute(rule.place.rect, screen.frame),
                ruleId = rule.id,
              })
              break
            end
          end
        end
      end
    end
  end

  return moves
end`;

/**
 * Runtime body: collects screens and windows from the live Hammerspoon
 * environment, resolves display roles, matches windows, and moves them.
 *
 * If LAYOUT.options.dockDisplay is set:
 *   1. Mouse is moved to the bottom of that display (activates it as the
 *      Dock's target display).
 *   2. Dock autohide is toggled true→false via AppleScript (both calls are
 *      synchronous), forcing the Dock to reappear on the now-active display.
 *   3. After 0.1s (for screen:frame() to reflect the new Dock position),
 *      the layout is applied.
 *
 * Prerequisite for minimal latency:
 *   defaults write com.apple.dock autohide-delay -float 0
 *   defaults write com.apple.dock autohide-time-modifier -float 0
 *   killall Dock
 */
const APPLY_BLOCK = `\
-- [[ Helpers: collect live state ]]
local function collectScreens()
  local builtinScreen = hs.screen.find("Built%-in")
  local builtinId = builtinScreen and builtinScreen:id() or nil
  local primaryId = hs.screen.primaryScreen():id()
  local screens = {}
  for _, screen in ipairs(hs.screen.allScreens()) do
    local frame = screen:frame()
    local fullFrame = screen:fullFrame()
    table.insert(screens, {
      _screen = screen,
      id = tostring(screen:id()),
      name = screen:name() or "",
      isBuiltin = (screen:id() == builtinId),
      isPrimary = (screen:id() == primaryId),
      frame = { x = frame.x, y = frame.y, w = frame.w, h = frame.h },
      fullFrame = { x = fullFrame.x, y = fullFrame.y, w = fullFrame.w, h = fullFrame.h },
    })
  end
  return screens
end

local function collectWindows()
  local focused = hs.window.focusedWindow()
  local windows = {}
  for _, win in ipairs(hs.window.allWindows()) do
    local isMinimized = win:isMinimized()
    if win:isStandard() and (not isMinimized or LAYOUT.options.restoreMinimized) then
      local app = win:application()
      local winFrame = win:frame()
      table.insert(windows, {
        _window = win,
        id = tostring(win:id()),
        app = {
          name = app and app:name() or "",
          bundleId = app and app:bundleID() or nil,
        },
        title = win:title() or "",
        isFocused = (win == focused),
        frame = { x = winFrame.x, y = winFrame.y, w = winFrame.w, h = winFrame.h },
      })
    end
  end
  return windows
end

-- [[ Apply: resolve, match, move ]]
local function doApply()
  local screens = collectScreens()
  local windows = collectWindows()
  local resolvedDisplays = resolveDisplayRoles(LAYOUT.displayRoles, screens)
  local moves = matchWindows(LAYOUT.windows, windows, resolvedDisplays)

  for _, move in ipairs(moves) do
    move.window:setFrame(hs.geometry.rect(move.frame.x, move.frame.y, move.frame.w, move.frame.h))
  end

  if LAYOUT.options.focusAfterApply and LAYOUT.options.focusAfterApply ~= "none" and #moves > 0 then
    if LAYOUT.options.focusAfterApply == "first" then
      moves[1].window:focus()
    else
      for _, move in ipairs(moves) do
        if move.ruleId == LAYOUT.options.focusAfterApply then
          move.window:focus()
          break
        end
      end
    end
  end
end

-- [[ Dock nudge: toggle autohide to force Dock to re-evaluate its display ]]
local function nudgeDock()
  hs.osascript.applescript([[
    tell application "System Events"
      tell dock preferences
        set autohide to true
      end tell
    end tell
  ]])
  hs.osascript.applescript([[
    tell application "System Events"
      tell dock preferences
        set autohide to false
      end tell
    end tell
  ]])
end

-- [[ Entry: optionally move Dock first, then apply ]]
if LAYOUT.options.dockDisplay then
  local screens = collectScreens()
  local resolved = resolveDisplayRoles(LAYOUT.displayRoles, screens)
  local dockScreen = resolved[LAYOUT.options.dockDisplay]
  if dockScreen then
    local ff = dockScreen.fullFrame
    hs.mouse.setAbsolutePosition({ x = ff.x + ff.w / 2, y = ff.y + ff.h - 1 })
    nudgeDock()
    hs.timer.doAfter(0.1, doApply)
  else
    doApply()
  end
else
  doApply()
end`;
