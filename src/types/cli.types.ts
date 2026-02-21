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

  /** Strict mode: required window rule(s) could not be satisfied */
  StrictFailure: 5,
} as const;

export type ExitCode = (typeof EXIT_CODE)[keyof typeof EXIT_CODE];

// ─── Shared CLI options ──────────────────────────────────────────────────────

export interface SharedCliOptions {
  /** Path to config file (default: ~/.config/layout/config.json) */
  readonly config?: string;

  /** Path to layouts directory (default: ~/.config/layout/layouts) */
  readonly layoutsDir?: string;

  /** Output machine-readable JSON */
  readonly json?: boolean;

  /** Verbose output */
  readonly verbose?: boolean;
}

// ─── Command-specific options ────────────────────────────────────────────────

export interface ApplyOptions extends SharedCliOptions {
  /** Print what would happen without moving windows */
  readonly dryRun?: boolean;

  /** Fail if any required rule can't be matched */
  readonly strict?: boolean;

  /** Timeout for Hammerspoon communication (ms) */
  readonly timeoutMs?: number;

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

  /** Include windows from hidden apps */
  readonly includeHidden?: boolean;
}

export interface ListOptions extends SharedCliOptions {}

export interface DoctorOptions extends SharedCliOptions {
  /** Show fix instructions for issues found */
  readonly fix?: boolean;
}
