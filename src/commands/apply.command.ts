import pc from 'picocolors';

import type { ApplyMove } from '../lib/apply-lua.js';
import { buildApplyLua } from '../lib/apply-lua.js';
import { resolveDisplayRoles } from '../lib/display-resolver.js';
import { DUMP_LUA } from '../lib/dump-lua.js';
import * as hs from '../lib/hammerspoon.js';
import { loadLayout } from '../lib/layout-loader.js';
import { normalizedToAbsolute } from '../lib/rect-converter.js';
import { matchWindows } from '../lib/window-matcher.js';
import type { ApplyOptions } from '../types/cli.types.js';
import { EXIT_CODE } from '../types/cli.types.js';
import type { Rect } from '../types/geometry.types.js';
import type { RuntimeWindow } from '../types/runtime.types.js';
import type { ApplyError, ApplyMoveResult, ApplySkipResult } from '../types/runtime.types.js';

// ─── Internal types ───────────────────────────────────────────────────────────

interface PlannedMove {
  readonly ruleId: string;
  readonly windowId: string;
  readonly app: string;
  readonly displayRole: string;
  readonly frame: Rect;
  readonly window: RuntimeWindow;
}

interface HsMoveResult {
  readonly windowId: string;
  readonly applied: boolean;
  readonly before?: Rect;
  readonly after?: Rect;
  readonly error?: string;
}

// ─── Command ──────────────────────────────────────────────────────────────────

interface ApplyCommandParams {
  readonly name: string;
  readonly options: ApplyOptions;
}

export async function applyCommand({ name, options }: ApplyCommandParams): Promise<number> {
  // 1. Load layout
  const loadResult = await loadLayout(name, options.layoutsDir);
  if (!loadResult.ok) {
    console.error(`${pc.red('Error:')} ${loadResult.error}`);
    return EXIT_CODE.LayoutInvalid;
  }
  const { layout } = loadResult;

  // 2. Check HS availability
  const available = await hs.isAvailable();
  if (!available) {
    console.error(
      `${
        pc.red('Error:')
      } Hammerspoon is not available. Is \`hs\` on your PATH and Hammerspoon running?`,
    );
    return EXIT_CODE.RuntimeUnavailable;
  }

  // 3. Dump current state
  const dumpResult = await hs.dump({ lua: DUMP_LUA });
  if (!dumpResult.ok) {
    console.error(`${pc.red('Error:')} ${dumpResult.error.message}`);
    return EXIT_CODE.Error;
  }
  const dump = dumpResult.value;

  // 4. Resolve display roles
  const resolvedRoles = resolveDisplayRoles(layout.displayRoles, [...dump.screens]);

  // 5. Match windows
  const { matched, skipped: windowSkips } = matchWindows(
    layout.windows,
    [...dump.windows],
    { restoreMinimized: layout.options?.restoreMinimized },
  );

  // 6. Build planned moves; collect display-unresolved skips
  const ruleMap = new Map(layout.windows.map((r) => [r.id, r]));
  const plannedMoves: PlannedMove[] = [];
  const displaySkips: ApplySkipResult[] = [];

  // When nudgeDock() has moved the Dock onto a display, that display's frame.h
  // shrinks by the Dock height (~48px). Windows saved before the Dock was there
  // used the larger frame. Extend the frame height back to the physical screen
  // bottom so windows are placed at the same pixel height as at save time.
  const dockDisplayRole = layout.options?.dockDisplay;

  for (const match of matched) {
    const rule = ruleMap.get(match.ruleId);
    if (!rule) continue;

    const screen = resolvedRoles[rule.place.display] ?? null;
    if (!screen) {
      displaySkips.push({
        ruleId: match.ruleId,
        app: match.window.app.name,
        reason: 'displayRoleUnresolved',
      });
      continue;
    }

    const frameForNorm = rule.place.display === dockDisplayRole
      ? {
        ...screen.frame,
        h: screen.fullFrame.y + screen.fullFrame.h - screen.frame.y,
      }
      : screen.frame;

    plannedMoves.push({
      ruleId: match.ruleId,
      windowId: match.windowId,
      app: match.window.app.name,
      displayRole: rule.place.display,
      frame: normalizedToAbsolute(rule.place.rect, frameForNorm),
      window: match.window,
    });
  }

  const allSkipped: ApplySkipResult[] = [...windowSkips, ...displaySkips];

  // 7. Dry run
  if (options.dryRun) {
    console.log(`\n${pc.bold('Dry run:')} ${pc.cyan(name)}`);
    console.log(`  Would move ${pc.bold(String(plannedMoves.length))} window(s)`);
    for (const m of plannedMoves) {
      console.log(`    ${pc.dim(`[${m.windowId}]`)} ${m.app} → ${m.displayRole}`);
    }
    if (allSkipped.length > 0) {
      console.log(`  Skipped ${allSkipped.length} rule(s)`);
    }
    console.log('');
    return EXIT_CODE.Success;
  }

  // 8. Send moves to HS
  const moves: ApplyMove[] = plannedMoves.map((m) => ({ windowId: m.windowId, frame: m.frame }));
  const luaResult = await hs.runLua(buildApplyLua(moves));
  if (!luaResult.ok) {
    console.error(`${pc.red('Error:')} ${luaResult.error.message}`);
    return EXIT_CODE.Error;
  }

  // 9. Parse HS response
  let hsResults: HsMoveResult[];
  try {
    hsResults = JSON.parse(luaResult.value) as HsMoveResult[];
  } catch {
    console.error(
      `${pc.red('Error:')} Hammerspoon returned invalid JSON: ${luaResult.value.slice(0, 200)}`,
    );
    return EXIT_CODE.Error;
  }

  // 10. Collect results
  const moved: ApplyMoveResult[] = [];
  const errors: ApplyError[] = [];

  for (const planned of plannedMoves) {
    const hsResult = hsResults.find((r) => r.windowId === planned.windowId);
    if (hsResult?.applied && hsResult.before && hsResult.after) {
      moved.push({
        windowId: planned.windowId,
        ruleId: planned.ruleId,
        app: planned.app,
        displayRole: planned.displayRole,
        from: hsResult.before,
        to: hsResult.after,
      });
    } else {
      errors.push({
        ruleId: planned.ruleId,
        message: hsResult?.error ?? `Window ${planned.windowId} not found`,
      });
    }
  }

  // 11. Output
  console.log('');
  console.log(`${pc.bold('Applied:')} ${pc.cyan(name)}`);
  console.log(`  ${pc.green('✓')} Moved ${moved.length} window(s)`);
  if (allSkipped.length > 0) console.log(`  Skipped ${allSkipped.length} rule(s)`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`  ${pc.red('✗')} ${e.message}`);
  }
  console.log('');

  return EXIT_CODE.Success;
}
