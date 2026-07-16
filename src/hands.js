// Hand tracking: MediaPipe HandLandmarker in VIDEO mode, plus the
// per-hand smoothing and finger-press detection the instrument runs on.

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { OneEuroFilter } from './one-euro.js';
import { jointAngle } from './geometry.js';

// Pinned to the same version as the npm package to avoid version skew.
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export const PALM_CENTER = 9; // middle-finger MCP — stable hand anchor

export async function createHandLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  return HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 2,
    // Slightly above the 0.5 defaults to suppress ghost hands.
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });
}

// Per-hand smoothing and press state. The One Euro filter itself lives
// in ./one-euro.js so it can be unit-tested without pulling MediaPipe.

const filterState = new Map(); // key (handedness label) -> per-axis filters
const fingerState = new Map(); // key -> [bool ×4] (finger currently pressed)

// Smooth all 21 landmarks, keyed by hand identity so the filters
// survive frame-to-frame and reset when a hand reappears.
export function smoothLandmarks(key, landmarks, timestampMs) {
  let state = filterState.get(key);
  if (!state) {
    state = {
      lastTime: timestampMs,
      filters: landmarks.map(() => ({
        x: new OneEuroFilter(),
        y: new OneEuroFilter(),
        z: new OneEuroFilter(),
      })),
      output: landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z })),
    };
    filterState.set(key, state);
  }

  const dt = Math.max((timestampMs - state.lastTime) / 1000, 1 / 120);
  state.lastTime = timestampMs;

  for (let i = 0; i < landmarks.length; i++) {
    state.output[i].x = state.filters[i].x.filter(landmarks[i].x, dt);
    state.output[i].y = state.filters[i].y.filter(landmarks[i].y, dt);
    state.output[i].z = state.filters[i].z.filter(landmarks[i].z, dt);
  }
  return state.output;
}

export function forgetHand(key) {
  filterState.delete(key);
  fingerState.delete(key);
}

export function forgetAllHands() {
  filterState.clear();
  fingerState.clear();
}

// --- Finger-press detection ---
// A finger counts as "pressed" when it bends at its middle knuckle
// (PIP), like pressing a key. The bend ANGLE is measured in 3D, so it
// only responds to actual curling — not hand tilt, not distance — and
// a light curl is enough; nobody should have to make a fist per finger.

const FINGERS = [
  { mcp: 5, pip: 6, tip: 8 }, // index
  { mcp: 9, pip: 10, tip: 12 }, // middle
  { mcp: 13, pip: 14, tip: 16 }, // ring
  { mcp: 17, pip: 18, tip: 20 }, // pinky
];

export const FINGER_TIPS = FINGERS.map((f) => f.tip);

// Straight finger ≈ 175°, relaxed droop ≈ 165°, light curl ≈ 145°,
// fist < 90°. Press on a light curl; release when mostly straight.
const BEND_ON_DEG = 150;
const BEND_OFF_DEG = 162;

export function fingerPresses(key, landmarks) {
  const previous = fingerState.get(key) ?? [false, false, false, false];
  const next = FINGERS.map((finger, i) => {
    const bend = jointAngle(landmarks[finger.mcp], landmarks[finger.pip], landmarks[finger.tip]);
    return previous[i] ? bend < BEND_OFF_DEG : bend < BEND_ON_DEG;
  });
  fingerState.set(key, next);
  return next;
}
