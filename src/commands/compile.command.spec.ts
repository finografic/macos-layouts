import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EXIT_CODE } from '../types/cli.types.js';
import { compileCommand } from './compile.command.js';

// ─── Mock fs/promises to intercept init.lua operations ────────────────────────

// Controls what the mock returns when init.lua is read (simulate existing content)
let initLuaExisting = '';
const initLuaCapture: { content: string | null } = { content: null };

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(async (...args: Parameters<typeof actual.readFile>) => {
      if (String(args[0]).includes('.hammerspoon/init.lua')) return initLuaExisting as never;
      return actual.readFile(...args);
    }),
    writeFile: vi.fn(async (...args: Parameters<typeof actual.writeFile>) => {
      if (String(args[0]).includes('.hammerspoon/init.lua')) {
        initLuaCapture.content = String(args[1]);
        return;
      }
      return actual.writeFile(...args);
    }),
    mkdir: vi.fn(async (...args: Parameters<typeof actual.mkdir>) => {
      if (String(args[0]).includes('.hammerspoon')) return undefined;
      return actual.mkdir(...args);
    }),
  };
});

// ─── Mock child_process to prevent Dock restarts ──────────────────────────────

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawnSync: vi.fn(() => ({ stdout: '0', stderr: '', status: 0 })) };
});

// ─── Test layouts ─────────────────────────────────────────────────────────────

const VALID_LAYOUT = {
  version: '0.1',
  name: 'test',
  displayRoles: { main: { match: { kind: 'primary' } } },
  windows: [
    {
      id: 'cursor-0',
      app: { bundleId: 'com.todesktop.230313mzl4w4u92', name: 'Cursor' },
      match: { kind: 'mainWindow' },
      place: { display: 'main', rect: { x: 0, y: 0, w: 1, h: 1 } },
    },
  ],
};

const DOCK_LAYOUT = { ...VALID_LAYOUT, name: 'test-dock', options: { dockDisplay: 'main' } };

// ─── Setup ────────────────────────────────────────────────────────────────────

let testDir = '';
let counter = 0;

beforeEach(async () => {
  vi.clearAllMocks();
  initLuaExisting = '';
  initLuaCapture.content = null;
  counter++;
  testDir = join(tmpdir(), `macos-layouts-compile-test-${counter}`);
  await mkdir(testDir, { recursive: true });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('compileCommand', () => {
  it('returns LayoutInvalid for a missing layout', async () => {
    const code = await compileCommand({
      name: 'nonexistent',
      options: { layoutsDir: testDir, output: join(testDir, 'out.lua') },
    });
    expect(code).toBe(EXIT_CODE.LayoutInvalid);
  });

  it('writes Lua file and returns Success', async () => {
    await writeFile(join(testDir, 'test.json'), JSON.stringify(VALID_LAYOUT));
    const outputPath = join(testDir, 'test.lua');
    const code = await compileCommand({
      name: 'test',
      options: { layoutsDir: testDir, output: outputPath },
    });
    expect(code).toBe(EXIT_CODE.Success);
    const lua = await readFile(outputPath, 'utf-8');
    expect(lua).toContain('hs.application.runningApplications()');
    expect(lua).not.toContain('hs.window.allWindows()');
  });

  it('init.lua snippet debounces apply inside _layoutsApply_* (hotkey + screen watcher)', async () => {
    await writeFile(
      join(testDir, 'test.json'),
      JSON.stringify({ ...VALID_LAYOUT, options: { hotkey: { mods: ['ctrl'], key: 'pad0' } } }),
    );
    await compileCommand({
      name: 'test',
      options: { layoutsDir: testDir, output: join(testDir, 'test.lua') },
    });
    const snippet = initLuaCapture.content ?? '';
    // Match through the real function end (not `if ... then return end`)
    const fnBlock =
      snippet.match(/local function _layoutsApply_test\(\)([\s\S]*?)\nhs\.hotkey\.bind/)?.[1] ?? '';
    expect(fnBlock).toContain('dofile');
    expect(fnBlock).toContain('_layoutsApply_test_lastRun');
    expect(fnBlock).toContain('secondsSinceEpoch');
    expect(snippet).toContain('hs.screen.watcher.new(_layoutsApply_test)');
  });

  it('init.lua snippet always registers hs.screen.watcher (same debounced fn as hotkey)', async () => {
    await writeFile(join(testDir, 'test.json'), JSON.stringify(VALID_LAYOUT));
    await compileCommand({
      name: 'test',
      options: { layoutsDir: testDir, output: join(testDir, 'test.lua') },
    });
    const snippet = initLuaCapture.content ?? '';
    expect(snippet).toContain('-- 🖥️ macos-layouts: test');
    expect(snippet).toContain('hs.screen.watcher.new(_layoutsApply_test)');
    expect(snippet).not.toContain('re-applies when Dock');
  });

  it('init.lua snippet adds Dock hint comment when dockDisplay is set', async () => {
    await writeFile(join(testDir, 'test-dock.json'), JSON.stringify(DOCK_LAYOUT));
    await compileCommand({
      name: 'test-dock',
      options: { layoutsDir: testDir, output: join(testDir, 'test-dock.lua') },
    });
    const snippet = initLuaCapture.content ?? '';
    expect(snippet).toContain('hs.screen.watcher.new(_layoutsApply_test_dock)');
    expect(snippet).toContain('re-applies when Dock moves/shows/hides');
  });

  it('skips init.lua update when marker already exists', async () => {
    await writeFile(join(testDir, 'test.json'), JSON.stringify(VALID_LAYOUT));
    initLuaExisting = 'layouts/test.lua'; // simulate marker already in init.lua
    const code = await compileCommand({
      name: 'test',
      options: { layoutsDir: testDir, output: join(testDir, 'test.lua') },
    });
    expect(code).toBe(EXIT_CODE.Success);
    expect(initLuaCapture.content).toBeNull(); // no write
  });
});
