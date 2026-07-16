import { describe, it, expect } from 'vitest';
import { SONGS, SongSession } from '../src/songs.js';

const FINGER_LANES = 8; // fixed mode reaches 8 scale degrees at once

describe('SongSession.registerAttack', () => {
  it('advances only on the target note and ignores wrong notes', () => {
    const s = new SongSession('Twinkle Twinkle');
    const target = s.target;
    const wrong = target === 0 ? 1 : 0;

    expect(s.registerAttack(wrong)).toEqual({ advanced: false, done: false });
    expect(s.position).toBe(0);

    expect(s.registerAttack(target)).toEqual({ advanced: true, done: false });
    expect(s.position).toBe(1);
  });

  it('completes at the last note and then ignores further input', () => {
    const s = new SongSession('Mary Had a Little Lamb');
    let last;
    for (const note of SONGS['Mary Had a Little Lamb'].notes) {
      last = s.registerAttack(note);
    }
    expect(last).toEqual({ advanced: true, done: true });
    expect(s.done).toBe(true);

    // Idempotent once done — no negative positions, no re-advance.
    expect(s.registerAttack(s.notes[0])).toEqual({ advanced: false, done: true });
  });
});

describe('every guided song is actually playable', () => {
  for (const name of Object.keys(SONGS)) {
    it(`${name}: notes fit the scale and the fixed 8-finger reach`, () => {
      const session = new SongSession(name);
      const notes = SONGS[name].notes;

      // Every degree indexes a real note in the song's own scale.
      for (const idx of notes) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(session.scale.length);
      }

      // The whole melody spans at most 8 degrees, so fixed mode (8
      // fingers anchored at the lowest note) can reach all of it.
      const span = Math.max(...notes) - Math.min(...notes);
      expect(span).toBeLessThan(FINGER_LANES);
    });
  }
});
