// Guided songs: the scale strip shows the next note to play; pressing
// it advances the song. Notes are scale-degree indices so a song
// carries its own scale/root and lanes stay wide enough to aim at.
// All melodies are beginner-range, public-domain tunes.

import { SCALES, buildScale } from './scales.js';

// Degree indices into the major scale (0 = do, 4 = sol…).
export const SONGS = {
  'Happy Birthday': {
    scaleName: 'Major',
    rootMidi: 60, // C4
    octaves: 2,
    notes: [
      4, 4, 5, 4, 7, 6,
      4, 4, 5, 4, 8, 7,
      4, 4, 11, 9, 7, 6, 5,
      10, 10, 9, 7, 8, 7,
    ],
  },
  'Twinkle Twinkle': {
    scaleName: 'Major',
    rootMidi: 60,
    octaves: 1,
    notes: [
      0, 0, 4, 4, 5, 5, 4,
      3, 3, 2, 2, 1, 1, 0,
      4, 4, 3, 3, 2, 2, 1,
      4, 4, 3, 3, 2, 2, 1,
      0, 0, 4, 4, 5, 5, 4,
      3, 3, 2, 2, 1, 1, 0,
    ],
  },
  'Mary Had a Little Lamb': {
    scaleName: 'Major',
    rootMidi: 60,
    octaves: 1,
    notes: [
      2, 1, 0, 1, 2, 2, 2,
      1, 1, 1,
      2, 4, 4,
      2, 1, 0, 1, 2, 2, 2, 2,
      1, 1, 2, 1, 0,
    ],
  },
  'Ode to Joy': {
    scaleName: 'Major',
    rootMidi: 60,
    octaves: 1,
    notes: [
      2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2, 2, 1, 1,
      2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2, 1, 0, 0,
    ],
  },
  'Row Row Row Your Boat': {
    scaleName: 'Major',
    rootMidi: 60,
    octaves: 1,
    notes: [
      0, 0, 0, 1, 2,
      2, 1, 2, 3, 4,
      7, 7, 7, 4, 4, 4, 2, 2, 2, 0, 0, 0,
      4, 3, 2, 1, 0,
    ],
  },
  'Jingle Bells': {
    scaleName: 'Major',
    rootMidi: 60,
    octaves: 1,
    notes: [
      2, 2, 2,
      2, 2, 2,
      2, 4, 0, 1, 2,
      3, 3, 3, 3,
      3, 2, 2, 2,
      2, 1, 1, 2,
      1, 4,
    ],
  },
};

export class SongSession {
  constructor(name) {
    const song = SONGS[name];
    this.name = name;
    this.notes = song.notes;
    this.scale = buildScale(song.rootMidi, SCALES[song.scaleName], song.octaves);
    this.perOctave = SCALES[song.scaleName].length;
    // Fixed finger mode anchors the 8 fingers at the melody's lowest
    // note, so any song spanning ≤ 8 scale degrees is fully reachable.
    this.fingerBase = Math.min(...song.notes);
    this.position = 0;
    this.done = false;
  }

  get target() {
    return this.notes[this.position];
  }

  get targetNote() {
    return this.scale[this.target];
  }

  // A hit is a key press of the target note; anything else is ignored.
  // Repeated notes register naturally — each press is its own attack.
  registerAttack(noteIndex) {
    if (this.done || noteIndex !== this.target) return { advanced: false, done: this.done };
    this.position += 1;
    if (this.position >= this.notes.length) this.done = true;
    return { advanced: true, done: this.done };
  }
}
