/**
 * @finografic/macos-layout — CLI types
 *
 * Type definitions for CLI command options and exit codes.
 * These are used internally by the CLI layer, not by Hammerspoon.
 */

// ─── Exit codes ──────────────────────────────────────────────────────────────

export const EXIT_CODE = {
  /** Successful execution */
  Success: 0,

  /** General error */
  Error: 1,

  /** Layout file not found or invalid */
  LayoutInvalid: 2,

  /** Hammerspoon runtime not available */
  RuntimeUnavailable: 3,

  /** Accessibility permissions not granted */
  PermissionDenied: 4,
} as const;

export type ExitCode = (typeof EXIT_CODE)[keyof typeof EXIT_CODE];

// ─── Shared CLI options ──────────────────────────────────────────────────────

export interface SharedCliOptions {
  /** Path to layouts directory (default: ~/.config/layout/layouts) */
  readonly layoutsDir?: string;

  /** Output machine-readable JSON */
  readonly json?: boolean;
}

// ─── Command-specific options ────────────────────────────────────────────────

export interface ApplyOptions extends SharedCliOptions {
  /** Print what would happen without moving windows */
  readonly dryRun?: boolean;

  /** What to focus after apply: "none", "first", or a rule id */
  readonly focus?: 'none' | 'first' | string;
}

export interface SaveOptions extends SharedCliOptions {
  /** Only include these apps (by name or bundleId) */
  readonly include?: readonly string[];

  /** Exclude these apps */
  readonly exclude?: readonly string[];

  /** Enable interactive prompts (default: true if TTY) */
  readonly interactive?: boolean;

  /** How to detect display roles: auto-detect or prompt user */
  readonly detectDisplays?: 'auto' | 'prompt';
}

export interface DumpOptions extends SharedCliOptions {
  /** Pretty-print JSON output */
  readonly pretty?: boolean;

  /** Include minimized windows in dump */
  readonly includeMinimized?: boolean;
}

export interface ListOptions extends SharedCliOptions {}

export interface DoctorOptions extends SharedCliOptions {
  /** Show fix instructions for issues found */
  readonly fix?: boolean;
}

export interface CompileOptions extends SharedCliOptions {
  /** Write the compiled Lua to this path instead of ~/.hammerspoon/layouts/<name>.lua */
  readonly output?: string;
}
