/**
 * @finografic/macos-layouts — Hammerspoon communication layer
 *
 * JSON-over-IPC bridge between the TS CLI and the Hammerspoon runtime.
 * All communication flows through `hs -c '<lua expr>'`, which evaluates
 * Lua in the running Hammerspoon instance and returns the result on stdout.
 *
 * TS → HS: Lua expression with payload embedded as a Lua long string
 * HS → TS: JSON string captured from stdout by execa
 *
 * The Lua module is loaded via require("macos-layout") in the running HS
 * instance. Use `layout doctor` to verify the module is reachable.
 */

import { execa, ExecaError } from 'execa';

import type { ApplyOptions } from '../types/cli.types.js';
import type { Layout } from '../types/layout.types.js';
import type { ApplyResult, RuntimeDump } from '../types/runtime.types.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const HS_BINARY = 'hs';
const HS_MODULE = 'macos-layout';
const DEFAULT_TIMEOUT_MS = 10_000;

// ─── Error types ─────────────────────────────────────────────────────────────

export type HammerspoonErrorKind =
  /** `hs` binary not found, or Hammerspoon is not running */
  | 'notFound'
  /** `hs -c` timed out waiting for a response */
  | 'timeout'
  /** `hs` exited non-zero for an unexpected reason */
  | 'execError'
  /** Hammerspoon returned output that is not valid JSON */
  | 'parseError'
  /** Hammerspoon returned a Lua error (module not found, permissions, etc.) */
  | 'luaError';

export interface HammerspoonError {
  readonly kind: HammerspoonErrorKind;
  readonly message: string;
  readonly exitCode?: number;
  readonly stderr?: string;
}

// ─── Result type ─────────────────────────────────────────────────────────────

/**
 * Discriminated union for explicit error handling.
 * Avoids try/catch at call sites — callers pattern-match on `ok`.
 */
export type HsResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: HammerspoonError };

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface RunHsParams {
  readonly expr: string;
  readonly timeoutMs?: number;
}

/** Run a Lua expression in the running Hammerspoon instance via `hs -c`. */
async function runHs(
  { expr, timeoutMs = DEFAULT_TIMEOUT_MS }: RunHsParams,
): Promise<HsResult<string>> {
  try {
    const { stdout } = await execa(HS_BINARY, ['-c', expr], {
      timeout: timeoutMs,
      stripFinalNewline: true,
      input: '',
    });
    // Strip Hammerspoon info lines (e.g. "-- Loading extension: json")
    // that prefix the actual return value on first use.
    const value = stdout.split('\n').filter((l) => !l.startsWith('--')).join('\n');
    return { ok: true, value };
  } catch (err) {
    if (!(err instanceof Error)) {
      return { ok: false, error: { kind: 'execError', message: String(err) } };
    }

    // ENOENT: `hs` binary not on PATH, or HS is not running
    if ('code' in err && (err as { code?: string }).code === 'ENOENT') {
      return {
        ok: false,
        error: {
          kind: 'notFound',
          message: 'Hammerspoon not found. Is `hs` on your PATH and Hammerspoon running?',
        },
      };
    }

    if (err instanceof ExecaError) {
      if (err.timedOut) {
        return {
          ok: false,
          error: {
            kind: 'timeout',
            message: `Hammerspoon did not respond within ${timeoutMs}ms.`,
          },
        };
      }
      // Non-zero exit: Lua error or IPC failure
      return {
        ok: false,
        error: {
          kind: 'luaError',
          message: err.stderr || err.message,
          exitCode: err.exitCode,
          stderr: err.stderr,
        },
      };
    }

    return { ok: false, error: { kind: 'execError', message: err.message } };
  }
}

/** Parse JSON from hs stdout; return a parseError if malformed. */
function parseJson<T>(raw: string): HsResult<T> {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    return {
      ok: false,
      error: {
        kind: 'parseError',
        message: `Hammerspoon returned invalid JSON: ${raw.slice(0, 200)}`,
      },
    };
  }
}

/**
 * Wrap a string in a Lua long-string literal that safely survives any content.
 *
 * Lua long strings use `[N=[` / `]=N]` delimiters where N is any number of `=`
 * signs. We pick the shortest N such that the closing delimiter cannot appear
 * in the payload. For JSON this is almost always level 0 (`[[...]]`), but the
 * function increments the level defensively.
 */
export function luaLongString(s: string): string {
  let level = 0;
  while (s.includes(`]${'='.repeat(level)}]`)) {
    level++;
  }
  const eq = '='.repeat(level);
  // Wrap with newlines: Lua strips the leading newline so the decoded value
  // is unchanged. The trailing newline prevents boundary collision when the
  // content ends with ']' (e.g. JSON arrays), which would otherwise cause
  // ']' + ']]' = ']]]' to close the long string one character too early.
  return `[${eq}[\n${s}\n]${eq}]`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface IsAvailableParams {
  readonly timeoutMs?: number;
}

export interface DumpParams {
  /** Self-contained Lua script to execute; must return a JSON string. */
  readonly lua: string;
  readonly timeoutMs?: number;
}

export interface ApplyParams {
  readonly layout: Layout;
  readonly options?: Pick<ApplyOptions, 'dryRun' | 'timeoutMs'>;
}

/**
 * Check whether the Hammerspoon runtime is reachable.
 *
 * Returns false if `hs` is not on PATH, Hammerspoon is not running,
 * or the call times out. Safe to call from `layout doctor`.
 */
export async function isAvailable({ timeoutMs = 3_000 }: IsAvailableParams = {}): Promise<boolean> {
  const result = await runHs({ expr: 'return "ok"', timeoutMs });
  return result.ok;
}

/**
 * Fetch the current runtime state from Hammerspoon.
 *
 * Returns a snapshot of all screens and standard windows.
 * This is the primary data source for `layout dump` and the
 * matching phase of `layout apply`.
 */
export async function dump({ lua, timeoutMs }: DumpParams): Promise<HsResult<RuntimeDump>> {
  const raw = await runHs({ expr: lua, timeoutMs });
  if (!raw.ok) return raw;
  return parseJson<RuntimeDump>(raw.value);
}

/**
 * Run an arbitrary Lua expression in the running Hammerspoon instance.
 * Returns the raw stdout string. Use this for self-contained IIFE scripts.
 */
export async function runLua(lua: string, timeoutMs?: number): Promise<HsResult<string>> {
  return runHs({ expr: lua, timeoutMs });
}

/**
 * Apply a layout to the current windows via Hammerspoon.
 *
 * The layout JSON is embedded in the Lua expression as a long string,
 * avoiding all shell-escaping concerns. Hammerspoon decodes it, executes
 * the placement rules, and returns a structured ApplyResult.
 */
export async function apply({ layout, options }: ApplyParams): Promise<HsResult<ApplyResult>> {
  const payload = JSON.stringify({ layout, options: options ?? {} });
  const luaPayload = luaLongString(payload);
  const expr =
    `return hs.json.encode(require("${HS_MODULE}").apply(hs.json.decode(${luaPayload})))`;

  const raw = await runHs({ expr, timeoutMs: options?.timeoutMs });
  if (!raw.ok) return raw;
  return parseJson<ApplyResult>(raw.value);
}
