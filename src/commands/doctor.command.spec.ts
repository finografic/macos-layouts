import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EXIT_CODE } from '../types/cli.types.js';

// ─── Mock execa ───────────────────────────────────────────────────────────────

vi.mock('execa', () => ({
  execa: vi.fn(),
  ExecaError: class ExecaError extends Error {},
}));

import { execa } from 'execa';

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

// ─── Mock node:fs/promises ────────────────────────────────────────────────────

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, access: vi.fn() };
});

import { access } from 'node:fs/promises';

// ─── Mock layout-loader (listLayouts) ─────────────────────────────────────────

vi.mock('../lib/layout-loader.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/layout-loader.js')>();
  return { ...actual, listLayouts: vi.fn().mockResolvedValue(['home', 'work']) };
});

import { doctorCommand } from './doctor.command.js';

// ─── Setup ────────────────────────────────────────────────────────────────────

const MOCK_DUMP = {
  ok: true,
  value: {
    timestamp: '',
    screens: [
      {
        id: '4',
        name: 'LG HDR 4K',
        isPrimary: true,
        isBuiltin: false,
        frame: { x: 0, y: 30, w: 3840, h: 2130 },
        fullFrame: { x: 0, y: 0, w: 3840, h: 2160 },
        resolution: { w: 3840, h: 2160 },
      },
    ],
    windows: [],
  },
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(execa).mockResolvedValue({ stdout: '/usr/local/bin/hs' } as never);
  vi.mocked(hs.isAvailable).mockResolvedValue(true);
  vi.mocked(hs.runLua).mockResolvedValue({ ok: true, value: 'ok' });
  vi.mocked(hs.dump).mockResolvedValue(MOCK_DUMP as never);
  vi.mocked(access).mockResolvedValue(undefined);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('doctorCommand', () => {
  it('all checks pass → exit 0', async () => {
    vi.mocked(hs.runLua)
      .mockResolvedValueOnce({ ok: true, value: 'ok' }) // IPC check
      .mockResolvedValueOnce({ ok: true, value: 'true' }); // accessibility check

    const code = await doctorCommand({ options: {} });
    expect(code).toBe(EXIT_CODE.Success);
  });

  it('hs binary not found → exit 1 with error message', async () => {
    vi.mocked(execa).mockRejectedValue(new Error('not found'));

    const code = await doctorCommand({ options: {} });
    expect(code).toBe(EXIT_CODE.Error);

    const loggedText = vi
      .mocked(console.log)
      .mock.calls.map((c) => String(c[0]))
      .join('\n');
    expect(loggedText).toMatch(/not found/i);
  });

  it('hs not running → exit 1', async () => {
    vi.mocked(hs.isAvailable).mockResolvedValue(false);

    const code = await doctorCommand({ options: {} });
    expect(code).toBe(EXIT_CODE.Error);
  });

  it('layouts dir missing → exit 0 (warning, not critical)', async () => {
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'));
    vi.mocked(hs.runLua)
      .mockResolvedValueOnce({ ok: true, value: 'ok' })
      .mockResolvedValueOnce({ ok: true, value: 'true' });

    const code = await doctorCommand({ options: {} });
    expect(code).toBe(EXIT_CODE.Success);
  });

  it('--json outputs structured JSON', async () => {
    vi.mocked(hs.runLua)
      .mockResolvedValueOnce({ ok: true, value: 'ok' })
      .mockResolvedValueOnce({ ok: true, value: 'true' });

    await doctorCommand({ options: { json: true } });

    const jsonOutput = vi.mocked(console.log).mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(jsonOutput) as { checks: unknown[]; screens: unknown[] };
    expect(parsed).toHaveProperty('checks');
    expect(parsed).toHaveProperty('screens');
    expect(Array.isArray(parsed.checks)).toBe(true);
  });
});
