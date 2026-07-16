import { describe, it, expect } from 'vitest';
import { SCALES, buildScale, indexForPosition, rootToMidi } from '../src/scales.js';

describe('rootToMidi', () => {
  it('places C4 at MIDI 60 and A4 at 69', () => {
    expect(rootToMidi(0, 4)).toBe(60); // C4
    expect(rootToMidi(9, 4)).toBe(69); // A4
  });
});

describe('buildScale', () => {
  it('spans the requested octaves plus a resolving top root', () => {
    const major = SCALES['Major']; // 7 degrees
    const scale = buildScale(60, major, 2);
    expect(scale).toHaveLength(2 * major.length + 1); // 15
    expect(scale[0].midi).toBe(60);
    expect(scale[scale.length - 1].midi).toBe(60 + 2 * 12); // top root, +2 octaves
  });

  it('tunes A4 to 440 Hz', () => {
    const scale = buildScale(69, [0], 1); // just the root A4
    expect(scale[0].freq).toBeCloseTo(440);
    expect(scale[0].name).toBe('A4');
  });

  it('emits ascending MIDI numbers', () => {
    const scale = buildScale(60, SCALES['Major pentatonic'], 3);
    for (let i = 1; i < scale.length; i++) {
      expect(scale[i].midi).toBeGreaterThan(scale[i - 1].midi);
    }
  });
});

describe('indexForPosition', () => {
  const scale = buildScale(60, SCALES['Major'], 1); // length 8

  it('clamps to valid indices at both ends', () => {
    expect(indexForPosition(scale, 0)).toBe(0);
    expect(indexForPosition(scale, 1)).toBe(scale.length - 1);
    expect(indexForPosition(scale, -0.3)).toBe(0);
    expect(indexForPosition(scale, 1.7)).toBe(scale.length - 1);
  });

  it('maps the middle of the range to a middle index', () => {
    expect(indexForPosition(scale, 0.5)).toBe(Math.floor(0.5 * scale.length));
  });
});
