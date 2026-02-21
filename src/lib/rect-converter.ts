import type { NormalizedRect, Rect } from '../types/geometry.types.js';

export function normalizedToAbsolute(normalized: NormalizedRect, screenFrame: Rect): Rect {
  return {
    x: Math.round(screenFrame.x + normalized.x * screenFrame.w),
    y: Math.round(screenFrame.y + normalized.y * screenFrame.h),
    w: Math.round(normalized.w * screenFrame.w),
    h: Math.round(normalized.h * screenFrame.h),
  };
}

export function absoluteToNormalized(absolute: Rect, screenFrame: Rect): NormalizedRect {
  return {
    x: (absolute.x - screenFrame.x) / screenFrame.w,
    y: (absolute.y - screenFrame.y) / screenFrame.h,
    w: absolute.w / screenFrame.w,
    h: absolute.h / screenFrame.h,
  };
}
