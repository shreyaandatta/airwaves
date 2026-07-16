// Bootstrap and conductor: start/pause the session, run the per-frame
// loop (detect → smooth → finger presses → sound + visuals), and wire
// the dock, play modes, tutorial, guided songs, and recorder together.

import {
  createHandLandmarker,
  smoothLandmarks,
  forgetHand,
  forgetAllHands,
  fingerPresses,
  FINGER_TIPS,
  PALM_CENTER,
} from './hands.js';
import {
  initAudio,
  fingerNoteOn,
  fingerNoteOff,
  releaseAll,
  getAmplitude,
  getRecordStream,
} from './audio.js';
import {
  SCALES,
  ROOT_NAMES,
  DEFAULT_SCALE,
  DEFAULT_ROOT,
  DEFAULT_OCTAVE,
  MIN_OCTAVE,
  MAX_OCTAVE,
  rootToMidi,
  buildScale,
} from './scales.js';
import { makeMapper, resizeCanvas, clearCanvas, drawHand, drawLabel } from './draw.js';
import { slideWindowBase as computeSlideBase } from './geometry.js';
import { TrailField } from './trails.js';
import { Tutorial } from './tutorial.js';
import { SONGS, SongSession } from './songs.js';
import { renderStrip, updateStrip, flashLane } from './strip.js';
import { isRecording, startRecording, stopRecording, captureFrame } from './recorder.js';
import './style.css';

const video = document.getElementById('webcam');
const canvas = document.getElementById('overlay');
const startPanel = document.getElementById('start-panel');
const startButton = document.getElementById('start-btn');
const startTutorialButton = document.getElementById('start-tutorial-btn');
const startError = document.getElementById('start-error');
const hud = document.getElementById('hud');
const noteReadout = document.getElementById('note-readout');
const pauseButton = document.getElementById('pause-btn');
const recordButton = document.getElementById('record-btn');
const recTimer = document.getElementById('rec-timer');
const dock = document.getElementById('dock');
const scaleSelect = document.getElementById('scale-select');
const rootSelect = document.getElementById('root-select');
const octDown = document.getElementById('oct-down');
const octUp = document.getElementById('oct-up');
const octLabel = document.getElementById('oct-label');
const modeSelect = document.getElementById('mode-select');
const tutorialButton = document.getElementById('tutorial-btn');
const songSelect = document.getElementById('song-select');
const songBar = document.getElementById('song-bar');
const songTitle = document.getElementById('song-title');
const songProgress = document.getElementById('song-progress');
const songExit = document.getElementById('song-exit');
const strip = document.getElementById('strip');
const lanesEl = document.getElementById('lanes');
const pausedOverlay = document.getElementById('paused-overlay');
const resumeButton = document.getElementById('resume-btn');
const resumeError = document.getElementById('resume-error');

// Piano layout, in on-screen (mirrored) order per hand: the leftmost
// finger on screen plays the lowest note of that hand's window.
// fingerPresses() reports [index, middle, ring, pinky].
const FINGER_OFFSETS = { Left: [3, 2, 1, 0], Right: [0, 1, 2, 3] };
const HAND_SPAN = 4; // notes under one hand
const FINGER_LANES = 8; // fixed mode reach across both hands
// Slide mode maps only this central band of the frame to the full
// window range, so reaching the lowest/highest window never pushes the
// palm to the very edge — where the outer fingers would leave the frame
// and stop being tracked. The margin is the room the hand needs.
const SLIDE_EDGE_MARGIN = 0.2;

let handLandmarker = null;
let cameraStream = null;
let audioReady = false;
let rafId = null;
let lastVideoTime = -1;
let lastFrameTime = 0;
let lastReadoutText = '';

const scaleSettings = { name: DEFAULT_SCALE, root: DEFAULT_ROOT, octave: DEFAULT_OCTAVE };
let scale = [];
let perOctave = SCALES[DEFAULT_SCALE].length;
let playMode = 'fingers'; // 'fingers' (fixed 8 keys) | 'slide' (windows follow hands)
let songSession = null;
const heldFingers = new Map(); // `${label}:${finger}` -> { freq, name, index }
const handBase = new Map(); // label -> window start (slide mode)

const trails = new TrailField();
const tutorial = new Tutorial(document.getElementById('tutorial'));

// --- Dock setup ---

for (const name of Object.keys(SCALES)) {
  scaleSelect.appendChild(new Option(name, name, false, name === DEFAULT_SCALE));
}
for (let i = 0; i < ROOT_NAMES.length; i++) {
  rootSelect.appendChild(new Option(ROOT_NAMES[i], i, false, i === DEFAULT_ROOT));
}
for (const name of Object.keys(SONGS)) {
  songSelect.appendChild(new Option(name, name));
}

function rebuildScale() {
  scale = buildScale(rootToMidi(scaleSettings.root, scaleSettings.octave), SCALES[scaleSettings.name]);
  perOctave = SCALES[scaleSettings.name].length;
  octLabel.textContent = ROOT_NAMES[scaleSettings.root] + scaleSettings.octave;
  octDown.disabled = scaleSettings.octave <= MIN_OCTAVE;
  octUp.disabled = scaleSettings.octave >= MAX_OCTAVE;
  renderStrip(lanesEl, scale, perOctave);
}
rebuildScale();

scaleSelect.addEventListener('change', () => {
  scaleSettings.name = scaleSelect.value;
  rebuildScale();
});
rootSelect.addEventListener('change', () => {
  scaleSettings.root = Number(rootSelect.value);
  rebuildScale();
});
octDown.addEventListener('click', () => {
  scaleSettings.octave = Math.max(MIN_OCTAVE, scaleSettings.octave - 1);
  rebuildScale();
});
octUp.addEventListener('click', () => {
  scaleSettings.octave = Math.min(MAX_OCTAVE, scaleSettings.octave + 1);
  rebuildScale();
});

function setPlayMode(mode) {
  if (mode === playMode) return;
  playMode = mode;
  releaseAll();
  heldFingers.clear();
  handBase.clear();
  modeSelect.value = mode;
  if (songSession) updateSongProgress(); // finger hint applies to fixed mode only
}

modeSelect.addEventListener('change', () => setPlayMode(modeSelect.value));
tutorialButton.addEventListener('click', () => tutorial.start());

// --- Guided song mode ---

songSelect.addEventListener('change', () => {
  if (songSelect.value) {
    startSong(songSelect.value);
  } else {
    exitSong();
  }
});
songExit.addEventListener('click', exitSong);

function startSong(name) {
  releaseAll(); // the scale is about to change under any held notes
  heldFingers.clear();
  handBase.clear();
  songSession = new SongSession(name);
  scale = songSession.scale; // song carries its own scale and range
  perOctave = songSession.perOctave;
  renderStrip(lanesEl, scale, perOctave);
  songTitle.textContent = name;
  updateSongProgress();
  songBar.classList.remove('hidden');
  songSelect.value = name;
  scaleSelect.disabled = rootSelect.disabled = octDown.disabled = octUp.disabled = true;
}

function exitSong() {
  if (!songSession) return;
  releaseAll();
  heldFingers.clear();
  handBase.clear();
  songSession = null;
  songBar.classList.add('hidden');
  songSelect.value = '';
  scaleSelect.disabled = rootSelect.disabled = false;
  rebuildScale(); // restores the player's scale, strip, and octave buttons
}

// Which finger reaches a scale index in fixed mode.
const FINGER_NAMES = ['pinky', 'ring', 'middle', 'index'];

function fingerHint(scaleIndex) {
  if (playMode !== 'fingers') return '';
  const offset = scaleIndex - songSession.fingerBase;
  if (offset < 0 || offset >= FINGER_LANES) return '';
  const half = FINGER_LANES / 2;
  return offset < half
    ? ` · L ${FINGER_NAMES[offset]}`
    : ` · R ${FINGER_NAMES[FINGER_LANES - 1 - offset]}`;
}

function updateSongProgress() {
  if (songSession.done) {
    songProgress.textContent = 'Song complete — nice!';
    return;
  }
  songProgress.textContent =
    `${songSession.position + 1}/${songSession.notes.length}` +
    ` · aim for ${songSession.targetNote.name}${fingerHint(songSession.target)}`;
}

// --- Session lifecycle ---

startButton.addEventListener('click', () => startSession(false));
startTutorialButton.addEventListener('click', () => startSession(true));
pauseButton.addEventListener('click', pauseSession);
resumeButton.addEventListener('click', resumeSession);

async function acquireCamera() {
  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: false,
  });
  video.srcObject = cameraStream;
  await new Promise((resolve) => video.addEventListener('loadeddata', resolve, { once: true }));
}

async function startSession(withTutorial) {
  startButton.disabled = startTutorialButton.disabled = true;
  startError.textContent = '';

  try {
    startButton.textContent = 'Starting audio…';
    if (!audioReady) {
      await initAudio();
      audioReady = true;
    }
    startButton.textContent = 'Enabling camera…';
    await acquireCamera();
    startButton.textContent = 'Loading hand tracker…';
    if (!handLandmarker) handLandmarker = await createHandLandmarker();
  } catch (error) {
    startButton.disabled = startTutorialButton.disabled = false;
    startButton.textContent = 'Start playing';
    startError.textContent = friendlyError(error);
    return;
  }

  startPanel.classList.add('hidden');
  hud.classList.remove('hidden');
  dock.classList.remove('hidden');
  strip.classList.remove('hidden');
  startLoop();
  if (withTutorial) tutorial.start();
}

function friendlyError(error) {
  return error.name === 'NotAllowedError'
    ? 'Camera access was denied. Allow camera access in your browser and try again.'
    : `Could not start: ${error.message}`;
}

// Pause fully stops the camera — the light goes off and nothing is
// captured. Resume re-acquires the stream (the permission persists).
function pauseSession() {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  if (isRecording()) stopRecordingUi();
  releaseAll();
  forgetAllHands();
  heldFingers.clear();
  handBase.clear();
  trails.clear();

  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  video.srcObject = null;
  lastVideoTime = -1;

  clearCanvas(canvas);
  resumeError.textContent = '';
  pausedOverlay.classList.remove('hidden');
  resumeButton.focus();
}

async function resumeSession() {
  resumeButton.disabled = true;
  resumeError.textContent = '';
  try {
    await acquireCamera();
  } catch (error) {
    resumeError.textContent = friendlyError(error);
    resumeButton.disabled = false;
    return;
  }
  resumeButton.disabled = false;
  pausedOverlay.classList.add('hidden');
  startLoop();
}

function startLoop() {
  resizeCanvas(canvas, video);
  lastFrameTime = performance.now();
  rafId = requestAnimationFrame(tick);
}

function sessionActive() {
  return rafId !== null || !pausedOverlay.classList.contains('hidden');
}

// --- Recording ---

recordButton.addEventListener('click', () => {
  if (isRecording()) {
    stopRecordingUi();
  } else {
    startRecording(video, canvas, getRecordStream(), (seconds) => {
      recTimer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    });
    recordButton.classList.add('active');
    recordButton.setAttribute('aria-pressed', 'true');
    recTimer.textContent = '0:00';
    recTimer.classList.remove('hidden');
  }
});

function stopRecordingUi() {
  stopRecording();
  recordButton.classList.remove('active');
  recordButton.setAttribute('aria-pressed', 'false');
  recTimer.classList.add('hidden');
}

// --- Per-frame loop ---

function tick(now) {
  resizeCanvas(canvas, video);
  lastFrameTime = now;

  if (video.videoWidth && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const results = handLandmarker.detectForVideo(video, now);
    const map = makeMapper(video, canvas);
    clearCanvas(canvas);

    const amplitude = getAmplitude();
    const seen = new Set();
    const playingIndices = [];
    const coveredRanges = [];
    let attackIndex = null; // scale index attacked this frame, for song hits

    for (let i = 0; i < results.landmarks.length; i++) {
      const label = results.handedness[i]?.[0]?.categoryName ?? 'Right';
      seen.add(label);
      const landmarks = smoothLandmarks(label, results.landmarks[i], now);
      const attack = playHand(label, landmarks, map, now, playingIndices, coveredRanges, amplitude);
      if (attack !== null) attackIndex = attack;
    }

    // Hands that left the frame: stop their notes, reset their state.
    for (const label of ['Left', 'Right']) {
      if (!seen.has(label)) {
        releaseFingersFor(label);
        forgetHand(label);
        handBase.delete(label);
      }
    }

    trails.step(canvas.getContext('2d'), now);

    if (songSession && attackIndex !== null) {
      const targetBefore = songSession.target;
      const { advanced, done } = songSession.registerAttack(attackIndex);
      if (advanced) {
        flashLane(lanesEl, targetBefore);
        updateSongProgress();
      }
      if (advanced && done) setTimeout(() => songSession && exitSong(), 3000);
    }

    updateStrip(lanesEl, {
      playingIndices,
      targetIndex: songSession && !songSession.done ? songSession.target : null,
      coveredRanges: coveredRanges.length ? coveredRanges : null,
    });

    tutorial.observe({
      handsSeen: results.landmarks.length,
      pressedCount: heldFingers.size,
      noteNames: [...heldFingers.values()].map((held) => held.name),
    });

    captureFrame(video, canvas);
    updateReadout();
  }

  rafId = requestAnimationFrame(tick);
}

// One hand = a 4-key window. Fixed mode plants the windows side by
// side (8 keys); slide mode lets each window follow its hand along the
// strip, so both hands together can reach the whole scale.
function playHand(label, landmarks, map, now, playingIndices, coveredRanges, amplitude) {
  const offsets = FINGER_OFFSETS[label];
  if (!offsets) return null;

  const start =
    playMode === 'slide'
      ? slideWindowBase(label, landmarks, map)
      : (songSession ? songSession.fingerBase : 0) + (label === 'Right' ? HAND_SPAN : 0);
  coveredRanges.push([start, Math.min(scale.length, start + HAND_SPAN)]);

  const palm = map(landmarks[PALM_CENTER]);
  const height = 1 - Math.min(1, Math.max(0, palm.y / map.height));
  const velocity = 0.2 + 0.8 * height;

  const presses = fingerPresses(label, landmarks);
  const pressedTips = [];
  let attackedIndex = null;

  for (let f = 0; f < presses.length; f++) {
    const key = `${label}:${f}`;
    const noteIndex = start + offsets[f];
    const note = scale[noteIndex];
    const held = heldFingers.get(key);

    if (presses[f] && note && !held) {
      fingerNoteOn(note.freq, velocity);
      heldFingers.set(key, { freq: note.freq, name: note.name, index: noteIndex });
      attackedIndex = noteIndex;
    } else if (!presses[f] && held) {
      fingerNoteOff(held.freq);
      heldFingers.delete(key);
    }

    const sounding = heldFingers.get(key);
    if (presses[f] && sounding) {
      playingIndices.push(sounding.index);
      pressedTips.push(FINGER_TIPS[f]);
      const tip = map(landmarks[FINGER_TIPS[f]]);
      trails.push(key, tip.x, tip.y, now);
      drawLabel(canvas, landmarks[FINGER_TIPS[f]], map, sounding.name);
    }
  }

  drawHand(canvas, landmarks, map, pressedTips.length > 0, amplitude, pressedTips);
  return attackedIndex;
}

// Slide mode: the window follows the palm's x position (see
// computeSlideBase in ./geometry.js for the mapping + hysteresis), but
// freezes entirely while any finger of that hand is held, so notes
// never retune under your fingers.
function slideWindowBase(label, landmarks, map) {
  if (anyHeld(label)) return handBase.get(label) ?? 0;

  const palm = map(landmarks[PALM_CENTER]);
  const next = computeSlideBase(palm.x / map.width, handBase.get(label) ?? null, {
    scaleLength: scale.length,
    handSpan: HAND_SPAN,
    margin: SLIDE_EDGE_MARGIN,
  });
  handBase.set(label, next);
  return next;
}

function anyHeld(label) {
  for (const key of heldFingers.keys()) {
    if (key.startsWith(`${label}:`)) return true;
  }
  return false;
}

function releaseFingersFor(label) {
  for (const [key, held] of heldFingers) {
    if (key.startsWith(`${label}:`)) {
      fingerNoteOff(held.freq);
      heldFingers.delete(key);
    }
  }
}

function updateReadout() {
  const names = [...heldFingers.values()].map((held) => held.name);
  const text = names.length ? names.slice(0, 4).join(' ') : '—';
  if (text !== lastReadoutText) {
    lastReadoutText = text;
    noteReadout.textContent = text;
  }
}

// --- Global handlers ---

// Space pauses/resumes (visible buttons remain the primary control).
document.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.target !== document.body || !sessionActive()) return;
  event.preventDefault();
  if (rafId === null) {
    resumeSession();
  } else {
    pauseSession();
  }
});

// Don't leave notes ringing when the tab goes to the background.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    releaseAll();
    heldFingers.clear();
  }
});
