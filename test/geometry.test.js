import { describe, it, expect } from 'vitest';
import { makeCoverMapper, slideWindowBase, jointAngle } from '../src/geometry.js';

describe('makeCoverMapper', () => {
  it('maps the frame center to the display center', () => {
    const map = makeCoverMapper({ displayW: 100, displayH: 100, videoW: 100, videoH: 100 });
    const p = map({ x: 0.5, y: 0.5 });
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(50);
  });

  it('mirrors horizontally — the left of the frame lands on the right', () => {
    const map = makeCoverMapper({ displayW: 100, displayH: 100, videoW: 100, videoH: 100 });
    expect(map({ x: 0, y: 0.5 }).x).toBeCloseTo(100);
    expect(map({ x: 1, y: 0.5 }).x).toBeCloseTo(0);
  });

  it('center-crops a wider camera frame instead of stretching it', () => {
    // 200x100 video into a 100x100 view: the sides are cropped, so the
    // frame center still maps to the display center (no distortion).
    const map = makeCoverMapper({ displayW: 100, displayH: 100, videoW: 200, videoH: 100 });
    const c = map({ x: 0.5, y: 0.5 });
    expect(c.x).toBeCloseTo(50);
    expect(c.y).toBeCloseTo(50);
  });

  it('exposes the display size for viewport clamping', () => {
    const map = makeCoverMapper({ displayW: 640, displayH: 480, videoW: 640, videoH: 480 });
    expect(map.width).toBe(640);
    expect(map.height).toBe(480);
  });
});

describe('slideWindowBase', () => {
  // 3-octave major (21 lanes), a 4-key hand window, 20% edge margin.
  const cfg = { scaleLength: 21, handSpan: 4, margin: 0.2 };
  const maxBase = 21 - 4; // 17
  const posToRaw = (pos) => (pos / (maxBase + 1)) * (1 - 2 * cfg.margin) + cfg.margin;

  it('centers the window when the palm is centered', () => {
    expect(slideWindowBase(0.5, null, cfg)).toBe(9);
  });

  it('reaches the top window before the palm hits the edge', () => {
    // The whole point of the margin: the top window is reachable well
    // inside the frame, leaving room for the outer fingers to stay seen.
    expect(slideWindowBase(0.8, null, cfg)).toBe(maxBase);
    expect(slideWindowBase(0.78, null, cfg)).toBe(maxBase);
  });

  it('reaches the bottom window and clamps past the margins', () => {
    expect(slideWindowBase(0.2, null, cfg)).toBe(0);
    expect(slideWindowBase(0.0, null, cfg)).toBe(0); // below margin → clamped
    expect(slideWindowBase(1.0, null, cfg)).toBe(maxBase); // above margin → clamped
  });

  it('holds the current window within the hysteresis band', () => {
    // Just past the boundary but inside the dead-band → stays put.
    expect(slideWindowBase(posToRaw(10.1), 9, cfg)).toBe(9);
    // Clearly past the boundary → advances.
    expect(slideWindowBase(posToRaw(10.3), 9, cfg)).toBe(10);
  });
});

describe('jointAngle', () => {
  it('reads ~180° for a straight finger (collinear, joint between)', () => {
    const angle = jointAngle({ x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    expect(angle).toBeCloseTo(180);
  });

  it('reads 90° for a right-angle bend', () => {
    const angle = jointAngle({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    expect(angle).toBeCloseTo(90);
  });

  it('reads ~0° when both segments point the same way (fully folded)', () => {
    const angle = jointAngle({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 });
    expect(angle).toBeCloseTo(0);
  });
});
