/**
 * @finografic/macos-layout — Display role types
 *
 * Layouts never reference physical displays directly.
 * Instead, they define semantic "roles" that are resolved at runtime
 * by matching against the current display environment.
 *
 * Resolution order matters — roles are resolved top-to-bottom,
 * and each physical display can only satisfy one role.
 * Once a display is claimed by a role, it's excluded from subsequent matching.
 */

// ─── Display matchers ────────────────────────────────────────────────────────

/** Match the built-in display (laptop screen) */
export interface DisplayMatchBuiltin {
  readonly kind: 'builtin';
}

/** Match the largest external display by pixel area (w × h of fullFrame) */
export interface DisplayMatchLargestExternal {
  readonly kind: 'largestExternal';
}

/** Match the smallest external display by pixel area */
export interface DisplayMatchSmallestExternal {
  readonly kind: 'smallestExternal';
}

/**
 * Match an external display by index after other roles have claimed theirs.
 * Index 0 = first unclaimed external (sorted by pixel area descending).
 * Useful when you have 3+ externals.
 */
export interface DisplayMatchExternalByIndex {
  readonly kind: 'externalByIndex';
  readonly index: number;
}

/**
 * Match by display name substring (e.g. "DELL", "LG").
 * Fragile — use only when physical identity truly matters.
 */
export interface DisplayMatchByName {
  readonly kind: 'byName';
  readonly name: string;
}

export type DisplayMatch =
  | DisplayMatchBuiltin
  | DisplayMatchLargestExternal
  | DisplayMatchSmallestExternal
  | DisplayMatchExternalByIndex
  | DisplayMatchByName;

// ─── Display role definition ─────────────────────────────────────────────────

/**
 * A display role is a named reference used by window placement rules.
 *
 * Roles are resolved in declaration order. Each matcher is tried
 * against the remaining (unclaimed) displays. First match wins.
 *
 * If `fallback` is provided and the primary match fails,
 * the fallback role name is used instead (must reference another role).
 */
export interface DisplayRole {
  /** Primary matcher for this role */
  readonly match: DisplayMatch;

  /**
   * Optional: if no display matches, fall back to this role's resolved display.
   * Example: secondaryExternal falls back to "builtin" if only one external exists.
   */
  readonly fallback?: string;
}

/**
 * Map of role names to their definitions.
 * Resolution is performed in insertion order (Map-like semantics).
 *
 * Common patterns:
 *   builtin          → { match: { kind: "builtin" } }
 *   mainExternal     → { match: { kind: "largestExternal" } }
 *   secondaryExternal → { match: { kind: "externalByIndex", index: 0 }, fallback: "builtin" }
 */
export type DisplayRoleMap = Record<string, DisplayRole>;
