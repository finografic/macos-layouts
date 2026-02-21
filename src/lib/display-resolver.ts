import type { DisplayMatch, DisplayRoleMap } from '../types/display.types.js';
import type { RuntimeScreen } from '../types/runtime.types.js';

function area(rect: { readonly w: number; readonly h: number }): number {
  return rect.w * rect.h;
}

function matchScreen(match: DisplayMatch, pool: RuntimeScreen[]): RuntimeScreen | null {
  switch (match.kind) {
    case 'builtin':
      return pool.find(s => s.isBuiltin) ?? null;

    case 'primary':
      return pool.find(s => s.isPrimary) ?? null;

    case 'largestExternal': {
      const externals = pool.filter(s => !s.isBuiltin);
      if (externals.length === 0) return null;
      return externals.reduce((best, s) => (area(s.fullFrame) > area(best.fullFrame) ? s : best));
    }

    case 'smallestExternal': {
      const externals = pool.filter(s => !s.isBuiltin);
      if (externals.length === 0) return null;
      return externals.reduce((best, s) => (area(s.fullFrame) <= area(best.fullFrame) ? s : best));
    }

    case 'externalByIndex': {
      const externals = pool.filter(s => !s.isBuiltin);
      const sorted = [...externals].sort((a, b) => area(b.fullFrame) - area(a.fullFrame));
      return sorted[match.index] ?? null;
    }

    case 'byName':
      return pool.find(s => s.name.includes(match.name)) ?? null;
  }
}

export function resolveDisplayRoles(
  roles: DisplayRoleMap,
  screens: RuntimeScreen[],
): Record<string, RuntimeScreen | null> {
  const resolved: Record<string, RuntimeScreen | null> = {};
  const pool = [...screens];

  for (const [roleName, role] of Object.entries(roles)) {
    const matched = matchScreen(role.match, pool);

    if (matched !== null) {
      pool.splice(pool.indexOf(matched), 1);
      resolved[roleName] = matched;
    } else if (role.fallback !== undefined) {
      resolved[roleName] = resolved[role.fallback] ?? null;
    } else {
      resolved[roleName] = null;
    }
  }

  return resolved;
}
