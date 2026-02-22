import { describe, expect, it } from 'vitest';

import fixture from '../__mocks__/dump-home-personal.json';
import type { DisplayMatch, DisplayRoleMap } from '../types/display.types.js';
import type { RuntimeScreen } from '../types/runtime.types.js';
import { resolveDisplayRoles } from './display-resolver.js';

const screens = fixture.screens as unknown as RuntimeScreen[];

// Helper: resolve a single-role map against the full screen pool
function matchSingle(match: DisplayMatch): RuntimeScreen | null {
  const roles: DisplayRoleMap = { target: { match } };
  const result = resolveDisplayRoles(roles, screens);
  return result['target'] ?? null;
}

// Fixture screens:
//   id "4" — LG HDR 4K,  isPrimary: true,  isBuiltin: false, fullFrame: 3840×2160
//   id "3" — LG Ultra HD, isPrimary: false, isBuiltin: false, fullFrame: 3840×2160

describe('resolveDisplayRoles', () => {
  describe('matchers', () => {
    it('primary → id "4"', () => {
      expect(matchSingle({ kind: 'primary' })?.id).toBe('4');
    });

    it('builtin → null (no builtin in fixture)', () => {
      expect(matchSingle({ kind: 'builtin' })).toBeNull();
    });

    it('largestExternal → id "4" (same area, first wins)', () => {
      expect(matchSingle({ kind: 'largestExternal' })?.id).toBe('4');
    });

    it('smallestExternal → id "3" (same area, last wins)', () => {
      expect(matchSingle({ kind: 'smallestExternal' })?.id).toBe('3');
    });

    it('externalByIndex 0 → id "4" (largest first)', () => {
      expect(matchSingle({ kind: 'externalByIndex', index: 0 })?.id).toBe('4');
    });

    it('externalByIndex 1 → id "3"', () => {
      expect(matchSingle({ kind: 'externalByIndex', index: 1 })?.id).toBe('3');
    });

    it('externalByIndex 2 → null (out of bounds)', () => {
      expect(matchSingle({ kind: 'externalByIndex', index: 2 })).toBeNull();
    });

    it('byName "Ultra HD" → id "3"', () => {
      expect(matchSingle({ kind: 'byName', name: 'Ultra HD' })?.id).toBe('3');
    });

    it('byName "LG" → id "4" (first match)', () => {
      expect(matchSingle({ kind: 'byName', name: 'LG' })?.id).toBe('4');
    });

    it('byName "nonexistent" → null', () => {
      expect(matchSingle({ kind: 'byName', name: 'nonexistent' })).toBeNull();
    });
  });

  describe('claim exclusion', () => {
    it('primary claims "4", externalByIndex 0 gets remaining "3"', () => {
      const roles: DisplayRoleMap = {
        main: { match: { kind: 'primary' } },
        secondary: { match: { kind: 'externalByIndex', index: 0 } },
      };
      const result = resolveDisplayRoles(roles, screens);
      expect(result['main']?.id).toBe('4');
      expect(result['secondary']?.id).toBe('3');
    });

    it('two primary roles: first gets "4", second gets null', () => {
      const roles: DisplayRoleMap = {
        a: { match: { kind: 'primary' } },
        b: { match: { kind: 'primary' } },
      };
      const result = resolveDisplayRoles(roles, screens);
      expect(result['a']?.id).toBe('4');
      expect(result['b']).toBeNull();
    });
  });

  describe('fallback resolution', () => {
    it('builtin falls back to mainDisplay (primary)', () => {
      const roles: DisplayRoleMap = {
        mainDisplay: { match: { kind: 'primary' } },
        laptop: { match: { kind: 'builtin' }, fallback: 'mainDisplay' },
      };
      const result = resolveDisplayRoles(roles, screens);
      expect(result['mainDisplay']?.id).toBe('4');
      expect(result['laptop']?.id).toBe('4');
    });

    it('fallback to a role that resolved to null → null', () => {
      const roles: DisplayRoleMap = {
        a: { match: { kind: 'builtin' } },
        b: { match: { kind: 'builtin' }, fallback: 'a' },
      };
      const result = resolveDisplayRoles(roles, screens);
      expect(result['a']).toBeNull();
      expect(result['b']).toBeNull();
    });

    it('fallback to unknown role → null', () => {
      const roles: DisplayRoleMap = {
        x: { match: { kind: 'builtin' }, fallback: 'doesNotExist' },
      };
      const result = resolveDisplayRoles(roles, screens);
      expect(result['x']).toBeNull();
    });

    it('forward fallback (references a later role) → null', () => {
      const roles: DisplayRoleMap = {
        a: { match: { kind: 'builtin' }, fallback: 'b' },
        b: { match: { kind: 'primary' } },
      };
      const result = resolveDisplayRoles(roles, screens);
      expect(result['a']).toBeNull();
      expect(result['b']?.id).toBe('4');
    });

    it('circular fallback → both null', () => {
      const roles: DisplayRoleMap = {
        a: { match: { kind: 'builtin' }, fallback: 'b' },
        b: { match: { kind: 'builtin' }, fallback: 'a' },
      };
      const result = resolveDisplayRoles(roles, screens);
      expect(result['a']).toBeNull();
      expect(result['b']).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('empty screens → all roles resolve to null', () => {
      const roles: DisplayRoleMap = {
        main: { match: { kind: 'primary' } },
        ext: { match: { kind: 'largestExternal' } },
      };
      const result = resolveDisplayRoles(roles, []);
      expect(result['main']).toBeNull();
      expect(result['ext']).toBeNull();
    });

    it('empty roles → empty result', () => {
      const result = resolveDisplayRoles({}, screens);
      expect(result).toEqual({});
    });
  });
});
