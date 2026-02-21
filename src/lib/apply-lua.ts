import type { Rect } from '../types/geometry.types.js';
import { luaLongString } from './hammerspoon.js';

export interface ApplyMove {
  readonly windowId: string;
  readonly frame: Rect;
}

/**
 * Build a self-contained Lua IIFE that moves windows via Hammerspoon.
 *
 * The moves array is embedded as JSON. Each move uses hs.window.get(id)
 * to look up the window by numeric ID, then win:setFrame() to move it.
 * Returns a JSON array of per-window results.
 */
export function buildApplyLua(moves: readonly ApplyMove[]): string {
  const payload = luaLongString(JSON.stringify(moves));
  return `return (function()
  local moves = hs.json.decode(${payload})
  local results = {}
  for _, move in ipairs(moves) do
    local win = hs.window.get(tonumber(move.windowId))
    local entry = { windowId = move.windowId, applied = false }
    if win then
      local before = win:frame()
      win:setFrame(hs.geometry.rect(move.frame.x, move.frame.y, move.frame.w, move.frame.h))
      local after = win:frame()
      entry.applied = true
      entry.before = { x = before.x, y = before.y, w = before.w, h = before.h }
      entry.after = { x = after.x, y = after.y, w = after.w, h = after.h }
    else
      entry.error = "window not found"
    end
    table.insert(results, entry)
  end
  return hs.json.encode(results)
end)()`;
}
