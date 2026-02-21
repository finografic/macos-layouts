import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EXIT_CODE } from '../types/cli.types.js';
import { listCommand } from './list.command.js';

// ─── Test layouts ─────────────────────────────────────────────────────────────

const LAYOUT_ALPHA = {
  version: '0.1',
  name: 'alpha',
  description: 'Alpha layout',
  displayRoles: { main: { match: { kind: 'primary' } } },
  windows: [],
};

const LAYOUT_BETA = {
  version: '0.1',
  name: 'beta',
  displayRoles: { main: { match: { kind: 'primary' } } },
  windows: [],
};

// ─── Setup ────────────────────────────────────────────────────────────────────

let testDir = '';
let counter = 0;

beforeEach(async () => {
  counter++;
  testDir = join(tmpdir(), `macos-layouts-list-test-${counter}`);
  await mkdir(testDir, { recursive: true });
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('listCommand', () => {
  it('lists layouts sorted alphabetically', async () => {
    await writeFile(join(testDir, 'beta.json'), JSON.stringify(LAYOUT_BETA));
    await writeFile(join(testDir, 'alpha.json'), JSON.stringify(LAYOUT_ALPHA));
    const code = await listCommand({ options: { layoutsDir: testDir } });
    expect(code).toBe(EXIT_CODE.Success);
    const calls = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
    const combined = calls.join('\n');
    expect(combined).toContain('alpha');
    expect(combined).toContain('beta');
    expect(combined.indexOf('alpha')).toBeLessThan(combined.indexOf('beta'));
  });

  it('--json outputs a JSON array of names', async () => {
    await writeFile(join(testDir, 'alpha.json'), JSON.stringify(LAYOUT_ALPHA));
    await writeFile(join(testDir, 'beta.json'), JSON.stringify(LAYOUT_BETA));
    const code = await listCommand({ options: { layoutsDir: testDir, json: true } });
    expect(code).toBe(EXIT_CODE.Success);
    const output = vi.mocked(console.log).mock.calls[0]?.[0] ?? '';
    expect(JSON.parse(output)).toEqual(['alpha', 'beta']);
  });

  it('empty directory prints "No layouts found" message', async () => {
    const code = await listCommand({ options: { layoutsDir: testDir } });
    expect(code).toBe(EXIT_CODE.Success);
    expect(console.log).toHaveBeenCalledOnce();
    const output = vi.mocked(console.log).mock.calls[0]?.[0] ?? '';
    expect(output).toContain('No layouts found');
  });
});
