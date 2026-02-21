import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Layout } from '../types/layout.types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_LAYOUTS_DIR = '~/.config/macos-layouts/layouts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoadResult =
  | { readonly ok: true; readonly layout: Layout }
  | { readonly ok: false; readonly error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function expandHome(p: string): string {
  if (p.startsWith('~')) {
    return (process.env['HOME'] ?? '') + p.slice(1);
  }
  return p;
}

function isValidLayout(parsed: unknown): parsed is Layout {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;
  if (obj['version'] !== '0.1') return false;
  if (typeof obj['name'] !== 'string') return false;
  if (
    typeof obj['displayRoles'] !== 'object'
    || obj['displayRoles'] === null
    || Array.isArray(obj['displayRoles'])
    || Object.keys(obj['displayRoles'] as object).length === 0
  ) return false;
  if (!Array.isArray(obj['windows'])) return false;
  return true;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export async function loadLayout(name: string, layoutsDir?: string): Promise<LoadResult> {
  const dir = expandHome(layoutsDir ?? DEFAULT_LAYOUTS_DIR);
  const filePath = join(dir, `${name}.json`);

  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch {
    return { ok: false, error: `Layout not found: ${filePath}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: `Invalid JSON in layout file: ${filePath}` };
  }

  if (!isValidLayout(parsed)) {
    return {
      ok: false,
      error:
        `Layout "${name}" is missing required fields (version "0.1", name, displayRoles, windows)`,
    };
  }

  return { ok: true, layout: parsed };
}

export async function listLayouts(layoutsDir?: string): Promise<readonly string[]> {
  const dir = expandHome(layoutsDir ?? DEFAULT_LAYOUTS_DIR);
  try {
    const entries = await readdir(dir);
    return entries
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length))
      .sort();
  } catch {
    return [];
  }
}
