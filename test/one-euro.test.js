import { describe, it, expect } from 'vitest';
import { OneEuroFilter } from '../src/one-euro.js';

const DT = 1 / 60; // one 60fps frame

describe('OneEuroFilter', () => {
  it('passes the first sample through untouched (no warm-up lag)', () => {
    const f = new OneEuroFilter();
    expect(f.filter(0.42, DT)).toBe(0.42);
  });

  it('damps a sudden step instead of jumping', () => {
    const f = new OneEuroFilter();
    f.filter(0, DT);
    const out = f.filter(1, DT);
    expect(out).toBeGreaterThan(0);
    expect(out).toBeLessThan(1); // smoothed, not an instant snap
  });

  it('converges to a held-constant input without overshooting', () => {
    const f = new OneEuroFilter();
    f.filter(0, DT);
    let out = 0;
    for (let i = 0; i < 120; i++) out = f.filter(1, DT);
    expect(out).toBeGreaterThan(0.99);
    expect(out).toBeLessThanOrEqual(1);
  });

  it('suppresses jitter around a stationary point', () => {
    // A hand held "still" still jitters ±0.05; the filter should shrink
    // that noise well below the raw amplitude. This is what keeps notes
    // from flickering when you hold a finger down.
    const f = new OneEuroFilter();
    f.filter(0.5, DT);
    let maxDeviation = 0;
    for (let i = 0; i < 60; i++) {
      const noisy = 0.5 + (i % 2 === 0 ? 0.05 : -0.05);
      const out = f.filter(noisy, DT);
      if (i > 10) maxDeviation = Math.max(maxDeviation, Math.abs(out - 0.5));
    }
    expect(maxDeviation).toBeLessThan(0.05); // output swings less than the input
  });
});
