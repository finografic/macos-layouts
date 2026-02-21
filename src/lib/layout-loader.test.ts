import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { expandHome, listLayouts, loadLayout } from './layout-loader.js';

const VALID_LAYOUT = JSON.stringify({
  version: '0.1',
  name: 'test',
  displayRoles: { main: { match: { kind: 'primary' } } },
  windows: [],
});

let testDir = '';
let counter = 0;

beforeEach(async () => {
  counter++;
  testDir = join(tmpdir(), `macos-layouts-test-${counter}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('loadLayout', () => {
  it('loads a valid layout file', async () => {
    await writeFile(join(testDir, 'test.json'), VALID_LAYOUT);
    const result = await loadLayout('test', testDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.layout.name).toBe('test');
      expect(result.layout.version).toBe('0.1');
    }
  });

  it('returns error for non-existent file', async () => {
    const result = await loadLayout('nonexistent', testDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not found/i);
    }
  });

  it('returns error for invalid JSON', async () => {
    await writeFile(join(testDir, 'broken.json'), '{ not valid json }');
    const result = await loadLayout('broken', testDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/invalid json/i);
    }
  });

  it('returns error for JSON missing required fields', async () => {
    await writeFile(
      join(testDir, 'partial.json'),
      JSON.stringify({ version: '0.1', name: 'partial' }),
    );
    const result = await loadLayout('partial', testDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/missing required fields/i);
    }
  });

  it('returns error for wrong version', async () => {
    const badVersion = JSON.stringify({
      version: '0.2',
      name: 'bad',
      displayRoles: { main: { match: { kind: 'primary' } } },
      windows: [],
    });
    await writeFile(join(testDir, 'bad.json'), badVersion);
    const result = await loadLayout('bad', testDir);
    expect(result.ok).toBe(false);
  });

  it('returns error for empty displayRoles', async () => {
    const empty = JSON.stringify({
      version: '0.1',
      name: 'empty',
      displayRoles: {},
      windows: [],
    });
    await writeFile(join(testDir, 'empty.json'), empty);
    const result = await loadLayout('empty', testDir);
    expect(result.ok).toBe(false);
  });
});

describe('listLayouts', () => {
  it('returns sorted names of .json files without extension', async () => {
    await writeFile(join(testDir, 'work.json'), VALID_LAYOUT);
    await writeFile(join(testDir, 'home.json'), VALID_LAYOUT);
    const names = await listLayouts(testDir);
    expect(names).toEqual(['home', 'work']);
  });

  it('returns empty array for empty directory', async () => {
    const names = await listLayouts(testDir);
    expect(names).toEqual([]);
  });

  it('returns empty array for non-existent directory', async () => {
    const names = await listLayouts(join(testDir, 'does-not-exist'));
    expect(names).toEqual([]);
  });

  it('ignores non-json files', async () => {
    await writeFile(join(testDir, 'work.json'), VALID_LAYOUT);
    await writeFile(join(testDir, 'README.md'), '# readme');
    const names = await listLayouts(testDir);
    expect(names).toEqual(['work']);
  });
});

describe('expandHome', () => {
  it('replaces leading ~ with HOME', () => {
    const home = process.env['HOME'] ?? '';
    expect(expandHome('~/layouts')).toBe(`${home}/layouts`);
  });

  it('leaves absolute paths unchanged', () => {
    expect(expandHome('/absolute/path')).toBe('/absolute/path');
  });

  it('leaves relative paths unchanged', () => {
    expect(expandHome('relative/path')).toBe('relative/path');
  });
});
