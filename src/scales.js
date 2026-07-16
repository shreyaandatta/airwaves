// Scale definitions and note helpers.
// Pitch is always quantized to one of these scales so the instrument
// can never play a wrong note.

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function midiToName(midi) {
  return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

// Interval patterns (semitones from the root, within one octave).
export const SCALES = {
  'Major pentatonic': [0, 2, 4, 7, 9],
  'Minor pentatonic': [0, 3, 5, 7, 10],
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Whole tone': [0, 2, 4, 6, 8, 10],
};

export const ROOT_NAMES = NOTE_NAMES;

export const DEFAULT_SCALE = 'Major pentatonic';
export const DEFAULT_ROOT = 0; // C
export const DEFAULT_OCTAVE = 3; // C3
export const MIN_OCTAVE = 2;
export const MAX_OCTAVE = 5;
export const DEFAULT_OCTAVES_SPAN = 3;

export function rootToMidi(root, octave) {
  return 12 * (octave + 1) + root;
}

// Build a flat array of { midi, freq, name } spanning `octaves` octaves,
// topped off with the root an octave above so the sweep resolves.
export function buildScale(rootMidi, intervals, octaves = DEFAULT_OCTAVES_SPAN) {
  const notes = [];
  for (let octave = 0; octave < octaves; octave++) {
    for (const semitones of intervals) {
      const midi = rootMidi + octave * 12 + semitones;
      notes.push({ midi, freq: midiToFreq(midi), name: midiToName(midi) });
    }
  }
  const top = rootMidi + octaves * 12;
  notes.push({ midi: top, freq: midiToFreq(top), name: midiToName(top) });
  return notes;
}

// Map a normalized 0..1 position to an index into the scale.
export function indexForPosition(scale, x) {
  return Math.min(scale.length - 1, Math.max(0, Math.floor(x * scale.length)));
}

export function noteForPosition(scale, x) {
  return scale[indexForPosition(scale, x)];
}
