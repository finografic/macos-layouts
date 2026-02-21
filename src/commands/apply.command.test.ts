import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import fixture from '../../.claude/assets/dump-home-personal.json';
import { EXIT_CODE } from '../types/cli.types.js';
import type { RuntimeDump } from '../types/runtime.types.js';
import { applyCommand } from './apply.command.js';

// ─── Mock hammerspoon ─────────────────────────────────────────────────────────

vi.mock('../lib/hammerspoon.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/hammerspoon.js')>();
  return {
    ...actual,
    isAvailable: vi.fn(),
    dump: vi.fn(),
    runLua: vi.fn(),
  };
});

import * as hs from '../lib/hammerspoon.js';

// ─── Fixture data ─────────────────────────────────────────────────────────────

const runtimeDump = fixture as unknown as RuntimeDump;

// Cursor mainWindow (byIndex:0 since none focused) = id "52035", x:0, y:30
// Primary screen "4": frame { x:0, y:30, w:3840, h:2130 }
// Full-screen absolute: { x:0, y:30, w:3840, h:2130 }
const CURSOR_MOVE_RESULT = JSON.stringify([
  {
    windowId: '52035',
    applied: true,
    before: { x: 0, y: 30, w: 1920, h: 2081 },
    after: { x: 0, y: 30, w: 3840, h: 2130 },
  },
]);

// ─── Test layouts ─────────────────────────────────────────────────────────────

const VALID_LAYOUT = {
  version: '0.1',
  name: 'test',
  displayRoles: { main: { match: { kind: 'primary' } } },
  windows: [
    {
      id: 'cursor-main',
      app: { bundleId: 'com.todesktop.230313mzl4w4u92' },
      match: { kind: 'mainWindow' },
      place: { display: 'main', rect: { x: 0, y: 0, w: 1, h: 1 } },
    },
  ],
};

const UNRESOLVED_ROLE_LAYOUT = {
  version: '0.1',
  name: 'unresolved',
  displayRoles: { builtin: { match: { kind: 'builtin' } } },
  windows: [
    {
      id: 'cursor-on-builtin',
      app: { bundleId: 'com.todesktop.230313mzl4w4u92' },
      match: { kind: 'mainWindow' },
      place: { display: 'builtin', rect: { x: 0, y: 0, w: 1, h: 1 } },
    },
  ],
};

const STRICT_LAYOUT = {
  version: '0.1',
  name: 'strict',
  displayRoles: { main: { match: { kind: 'primary' } } },
  windows: [
    {
      id: 'missing-app',
      app: { bundleId: 'com.nonexistent.app' },
      match: { kind: 'mainWindow' },
      place: { display: 'main', rect: { x: 0, y: 0, w: 1, h: 1 } },
      required: true,
    },
  ],
};

// ─── Setup ────────────────────────────────────────────────────────────────────

let testDir = '';
let counter = 0;

beforeEach(async () => {
  vi.clearAllMocks();
  counter++;
  testDir = join(tmpdir(), `macos-layouts-apply-test-${counter}`);
  await mkdir(testDir, { recursive: true });

  vi.mocked(hs.isAvailable).mockResolvedValue(true);
  vi.mocked(hs.dump).mockResolvedValue({ ok: true, value: runtimeDump });
  vi.mocked(hs.runLua).mockResolvedValue({ ok: true, value: CURSOR_MOVE_RESULT });

  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('applyCommand', () => {
  it('applies valid layout with matching windows → ExitCode.Success, runLua called', async () => {
    await writeFile(join(testDir, 'test.json'), JSON.stringify(VALID_LAYOUT));
    const code = await applyCommand({ name: 'test', options: { layoutsDir: testDir } });
    expect(code).toBe(EXIT_CODE.Success);
    expect(hs.runLua).toHaveBeenCalledOnce();
  });

  it('dry-run returns ExitCode.Success without calling runLua', async () => {
    await writeFile(join(testDir, 'test.json'), JSON.stringify(VALID_LAYOUT));
    const code = await applyCommand({
      name: 'test',
      options: { layoutsDir: testDir, dryRun: true },
    });
    expect(code).toBe(EXIT_CODE.Success);
    expect(hs.runLua).not.toHaveBeenCalled();
  });

  it('non-existent layout → ExitCode.LayoutInvalid', async () => {
    const code = await applyCommand({ name: 'nonexistent', options: { layoutsDir: testDir } });
    expect(code).toBe(EXIT_CODE.LayoutInvalid);
    expect(hs.isAvailable).not.toHaveBeenCalled();
  });

  it('unresolved display role → command succeeds but runLua receives empty moves', async () => {
    await writeFile(join(testDir, 'unresolved.json'), JSON.stringify(UNRESOLVED_ROLE_LAYOUT));
    vi.mocked(hs.runLua).mockResolvedValue({ ok: true, value: '[]' });
    const code = await applyCommand({ name: 'unresolved', options: { layoutsDir: testDir } });
    expect(code).toBe(EXIT_CODE.Success);
    // runLua called with a Lua script that embeds an empty moves array
    expect(hs.runLua).toHaveBeenCalledOnce();
    const luaArg = vi.mocked(hs.runLua).mock.calls[0]?.[0] ?? '';
    // buildApplyLua([]) embeds JSON.stringify([]) = '[]' via luaLongString
    expect(luaArg).toMatch(/\[\[.*\]\]/s); // contains Lua long-string brackets
  });

  it('strict mode with missing required app → ExitCode.StrictFailure', async () => {
    await writeFile(join(testDir, 'strict.json'), JSON.stringify(STRICT_LAYOUT));
    const code = await applyCommand({
      name: 'strict',
      options: { layoutsDir: testDir, strict: true },
    });
    expect(code).toBe(EXIT_CODE.StrictFailure);
  });
});
