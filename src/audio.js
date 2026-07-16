// Audio engine: a polyphonic synth bank (one voice per finger, chords
// allowed) through a shared reverb, with click-free envelopes.

import * as Tone from 'tone';

let poly = null;
let reverb = null;
let meter = null;
let recordDestination = null;

export async function initAudio() {
  // Must be called from a user gesture — the browser blocks audio otherwise.
  await Tone.start();

  reverb = new Tone.Reverb({ decay: 3.5, wet: 0.35 }).toDestination();

  // Meter drives the reactive visuals; record destination lets the
  // recorder capture exactly what the speakers hear.
  meter = new Tone.Meter({ smoothing: 0.8 });
  reverb.connect(meter);
  recordDestination = Tone.getContext().rawContext.createMediaStreamDestination();
  Tone.connect(reverb, recordDestination);

  poly = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle8' },
    // Small non-zero attack/release avoids clicks and pops.
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.2 },
  }).connect(reverb);
  poly.maxPolyphony = 8; // one per non-thumb finger
}

export function fingerNoteOn(freq, velocity) {
  poly.triggerAttack(freq, Tone.now(), velocity);
}

export function fingerNoteOff(freq) {
  poly.triggerRelease(freq, Tone.now());
}

export function releaseAll() {
  poly?.releaseAll();
}

// --- Taps for visuals and recording ---

// Master loudness as 0..1 for the trail/glow intensity.
export function getAmplitude() {
  if (!meter) return 0;
  const db = meter.getValue();
  if (!Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, Math.pow(10, db / 20) * 2));
}

export function getRecordStream() {
  return recordDestination ? recordDestination.stream : null;
}
