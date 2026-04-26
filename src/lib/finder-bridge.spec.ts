import { describe, expect, it } from 'vitest';

import { parseBoundsOutput } from './finder-bridge.js';

describe('parseBoundsOutput', () => {
  it('parses braced {L,T,R,B} list', () => {
    const out = parseBoundsOutput('{0, 30, 400, 500}, {100, 30, 500, 600}');
    expect(out).toEqual([
      { left: 0, top: 30, right: 400, bottom: 500 },
      { left: 100, top: 30, right: 500, bottom: 600 },
    ]);
  });

  it('parses flat comma-separated quads (no braces, macOS string coercion)', () => {
    const raw =
      '1344, 1384, 2624, 2079, -2560, 1592, -1280, 2113, -1677, 1242, -397, 1937, 320, 65, 2665, 2091, 264, 852, 1184, 1316';
    const out = parseBoundsOutput(raw);
    expect(out).toHaveLength(5);
    expect(out[0]).toEqual({ left: 1344, top: 1384, right: 2624, bottom: 2079 });
    expect(out[4]).toEqual({ left: 264, top: 852, right: 1184, bottom: 1316 });
  });

  it('returns [] for empty or unparseable input', () => {
    expect(parseBoundsOutput('')).toEqual([]);
    expect(parseBoundsOutput('not numbers')).toEqual([]);
  });
});
