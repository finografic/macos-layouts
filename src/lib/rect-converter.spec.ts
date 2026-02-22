import { describe, expect, it } from 'vitest';

import type { Rect } from '../types/geometry.types.js';
import { absoluteToNormalized, normalizedToAbsolute } from './rect-converter.js';

// Fixture screen frames (usable, excluding menu bar):
//   LG HDR 4K:   { x:    0, y: 30, w: 3840, h: 2130 }
//   LG Ultra HD: { x: -3840, y: 30, w: 3840, h: 2082 }

const hdr4k: Rect = { x: 0, y: 30, w: 3840, h: 2130 };
const ultraHd: Rect = { x: -3840, y: 30, w: 3840, h: 2082 };

describe('normalizedToAbsolute', () => {
  it('full screen {0,0,1,1} → matches screen frame exactly', () => {
    expect(normalizedToAbsolute({ x: 0, y: 0, w: 1, h: 1 }, hdr4k)).toEqual(hdr4k);
  });

  it('left half {0,0,0.5,1}', () => {
    expect(normalizedToAbsolute({ x: 0, y: 0, w: 0.5, h: 1 }, hdr4k)).toEqual({
      x: 0,
      y: 30,
      w: 1920,
      h: 2130,
    });
  });

  it('right 40% {0.6,0,0.4,1}', () => {
    expect(normalizedToAbsolute({ x: 0.6, y: 0, w: 0.4, h: 1 }, hdr4k)).toEqual({
      x: 2304,
      y: 30,
      w: 1536,
      h: 2130,
    });
  });

  it('custom placement {0,0,0.62,1} on LG HDR 4K → correct pixel values', () => {
    const result = normalizedToAbsolute({ x: 0, y: 0, w: 0.62, h: 1 }, hdr4k);
    expect(result.x).toBe(0);
    expect(result.y).toBe(30);
    expect(result.w).toBe(Math.round(0.62 * 3840));
    expect(result.h).toBe(2130);
  });

  it('negative-x screen (LG Ultra HD) → absolute x is negative', () => {
    const result = normalizedToAbsolute({ x: 0, y: 0, w: 0.5, h: 1 }, ultraHd);
    expect(result.x).toBe(-3840);
    expect(result.w).toBe(1920);
  });

  it('zero-size rect → {x, y, 0, 0}', () => {
    expect(normalizedToAbsolute({ x: 0, y: 0, w: 0, h: 0 }, hdr4k)).toEqual({
      x: 0,
      y: 30,
      w: 0,
      h: 0,
    });
  });

  it('full screen on LG Ultra HD → different absolute rect than LG HDR 4K', () => {
    const a = normalizedToAbsolute({ x: 0, y: 0, w: 1, h: 1 }, hdr4k);
    const b = normalizedToAbsolute({ x: 0, y: 0, w: 1, h: 1 }, ultraHd);
    expect(a).not.toEqual(b);
    expect(b).toEqual(ultraHd);
  });
});

describe('absoluteToNormalized', () => {
  it('screen frame itself → {0,0,1,1}', () => {
    expect(absoluteToNormalized(hdr4k, hdr4k)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('negative-x screen → x:0 when window is flush with screen left edge', () => {
    const abs: Rect = { x: -3840, y: 30, w: 1920, h: 2082 };
    const result = absoluteToNormalized(abs, ultraHd);
    expect(result.x).toBeCloseTo(0);
    expect(result.w).toBeCloseTo(0.5);
  });
});

describe('round-trip', () => {
  it('normalizedToAbsolute then absoluteToNormalized ≈ original', () => {
    const normalized = { x: 0.1, y: 0.05, w: 0.6, h: 0.9 };
    const abs = normalizedToAbsolute(normalized, hdr4k);
    const back = absoluteToNormalized(abs, hdr4k);
    // Math.round introduces up to 0.5px error; at 2130px height that's ~0.0002 — use 3 decimal places
    expect(back.x).toBeCloseTo(normalized.x, 3);
    expect(back.y).toBeCloseTo(normalized.y, 3);
    expect(back.w).toBeCloseTo(normalized.w, 3);
    expect(back.h).toBeCloseTo(normalized.h, 3);
  });
});
