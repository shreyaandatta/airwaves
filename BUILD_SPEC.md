# Airwaves — Build Spec / Handoff Brief

> Hand this whole file to a coding session. It is self-contained: it defines what to
> build, the exact tech, the architecture, the tricky bits, and the acceptance criteria.
> Goal: a polished, demo-ready web app that a recruiter is impressed by and that wraps
> cleanly into a mobile app later.

---

## 1. One-line pitch
**Airwaves** — play music by moving your hands in the air. Your webcam tracks your hands
in real time; pinching triggers notes, hand position controls pitch and volume. No
controller, no MIDI keyboard — just gestures.

## 2. Who this is for / why it exists
Portfolio project for **Shreyaan Datta**, 3rd-year CSE student targeting Summer 2027 SWE
internships. It must showcase **hard, real-time, on-device skills** (computer-vision hand
tracking + low-latency audio synthesis) while being genuinely fun to demo on video for
LinkedIn. Keep the code clean and readable — the repo itself is part of the portfolio.

## 3. Non-negotiable requirements
- Runs entirely **client-side in the browser** (no backend, no API keys). Privacy story:
  the camera feed never leaves the device.
- **Real-time**: end-to-end gesture→sound latency must feel instant (< ~80ms perceived).
- Works on **desktop Chrome** first; mobile Safari/Chrome as a bonus (design for it).
- **It must always sound good** — quantize pitch to a musical scale so there are no wrong notes.
- Clean, modern, dark UI with live visual feedback (hand skeleton overlay + note readout).

## 4. Tech stack (use exactly these)
- **Build tool:** Vite (vanilla JS, `type: module`). No React needed — keep it light.
- **Hand tracking:** `@mediapipe/tasks-vision` → `HandLandmarker` in `VIDEO` running mode.
  - WASM fileset + model loaded from CDN (jsDelivr / Google storage), pinned to the same
    version as the npm package to avoid version-skew bugs. Pin `@mediapipe/tasks-vision`
    to a fixed version (e.g. `0.10.14`) and use the matching `@0.10.14` wasm URL.
  - Model: `hand_landmarker.task` (float16), 2 hands, from
    `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`
- **Audio:** `tone` (Tone.js). Web Audio under the hood.
- No other runtime deps unless justified.

## 5. Interaction model (the heart of it)
Per detected hand (support up to 2 simultaneously, independent voices):
- **Gate (note on/off):** pinch = distance between **thumb tip (landmark 4)** and
  **index tip (landmark 8)**, normalized by hand size (e.g. wrist→middle-MCP distance so
  it's depth-invariant). Below a threshold → note ON; above → note OFF.
- **Pitch:** horizontal position of the index fingertip (x, 0..1). Remember the webcam is
  **mirrored**, so flip x for intuitive left=low / right=high. Quantize x to an index into
  a **scale array** (see below) — never play arbitrary frequencies.
- **Volume / expression:** vertical position (y). Higher hand = louder (invert y since
  screen y grows downward). Map to a sane dB range (e.g. -30dB..0dB) or a filter cutoff.
- **Smoothing:** low-pass the landmark coordinates (EMA, alpha ~0.5) so the pitch/volume
  don't jitter frame to frame. Ramp synth frequency/volume with short `rampTo` (~30–60ms)
  instead of hard jumps — this is what makes it feel professional.

### Scale
Default to **C major pentatonic across ~3 octaves** (C, D, E, G, A) so every note is
consonant. Expose the scale as a swappable constant. Stretch: a dropdown to switch scales
(pentatonic / minor / whole-tone) and a root note.

## 6. Audio engine details
- One **Tone.Synth** (or `MonoSynth`) voice per hand, both routed through a shared
  `Tone.Reverb` (decay ~3–4s, wet ~0.35) → destination. Optionally a `Tone.Chorus` or
  `PingPongDelay` for atmosphere.
- Audio context must be started from a **user gesture** (the Start button) — call
  `await Tone.start()` there. Same click enables the camera. Browsers block both otherwise.
- On gate ON: `triggerAttack(freq)`. While held: `synth.frequency.rampTo(freq, 0.05)` and
  `synth.volume.rampTo(db, 0.05)`. On gate OFF: `triggerRelease()`.
- Avoid clicks/pops: use small non-zero attack/release envelopes.

## 7. Visual feedback
- Full-screen **mirrored webcam** as the background (subtle, dimmed).
- **Canvas overlay** drawing the 21-landmark hand skeleton per hand, mirrored to match.
- When a hand is "playing," make its skeleton **glow / change color** and render the
  current note name near the hand.
- A small HUD: app title, one-line instructions, and a live readout of the active note(s)
  and scale. Modern, dark, minimal. Feel free to add a faint particle/waveform reacting to
  amplitude for the "wow."
- Handle the resize + devicePixelRatio so the canvas stays crisp.

## 8. Suggested file structure
```
airwaves/
  index.html            # video + canvas + HUD + start button
  package.json
  vite.config.js        # (optional) base path for GitHub Pages / static host
  src/
    main.js             # bootstraps: start button → camera + audio + loop
    hands.js            # HandLandmarker setup + per-frame detect + smoothing
    audio.js            # Tone.js voices, scale mapping, gate/pitch/volume API
    draw.js             # canvas overlay: skeleton, glow, note labels
    scales.js           # scale definitions + note-name helpers
    style.css           # dark modern UI
  README.md
  .gitignore
```

## 9. Detailed loop (pseudocode)
```
on Start click:
  await Tone.start()
  getUserMedia({ video: { facingMode: 'user' } }) → video.srcObject
  handLandmarker = await createHandLandmarker()   // VIDEO mode, numHands: 2
  requestAnimationFrame(tick)

tick(now):
  const results = handLandmarker.detectForVideo(video, now)
  clear canvas
  for each hand in results.landmarks:
     smooth landmarks (EMA)
     draw skeleton (glow if gated)
     pinch = normalizedPinchDistance(hand)
     gate  = pinch < THRESHOLD
     x = 1 - indexTip.x            // mirror
     y = 1 - indexTip.y            // invert
     note = scale[floor(x * scale.length)]
     voice[handIndex].update(gate, note.freq, yToDb(y))
     draw note label if gated
  release voices for hands that disappeared
  requestAnimationFrame(tick)
```

## 10. Edge cases to handle
- No hands detected → release all voices (silence), don't leave a note stuck on.
- A hand leaving the frame mid-note → release that voice.
- Two hands crossing / swapping → track voices by MediaPipe handedness or by nearest-index
  continuity so voices don't glitch.
- Camera permission denied → friendly error message in the HUD, not a silent failure.
- Tab loses focus → optionally suspend audio.

## 11. Acceptance criteria (definition of done)
- [ ] Click Start → camera + audio enable together, no console errors.
- [ ] Moving a pinched hand left↔right sweeps pitch through the scale audibly.
- [ ] Raising/lowering the hand changes volume.
- [ ] Two hands play two independent voices at once.
- [ ] Releasing the pinch or removing the hand stops the note cleanly (no stuck notes/pops).
- [ ] Skeleton overlay is mirrored, smooth, and glows when playing.
- [ ] Runs at a smooth frame rate on a normal laptop.
- [ ] `npm install && npm run dev` works from a clean clone.
- [ ] README explains what it is, the stack, how to run, and a GIF/screenshot slot.

## 12. Stretch goals (only after MVP works)
- Scale + root-note picker; octave shift.
- Left hand = filter/effect control, right hand = melody.
- Record + export a short WAV/loop of what you played.
- Reactive particle/waveform visuals tied to amplitude.
- Capacitor wrapper so it installs as an iOS/Android app (document the steps).
- PWA manifest for "add to home screen."

## 13. Portfolio / README positioning (write these into README.md)
- Framing: *"A real-time, on-device musical instrument you play with hand gestures —
  computer vision + audio DSP, 100% in the browser."*
- Call out the hard skills explicitly: real-time hand-landmark tracking, coordinate
  smoothing, musical quantization, low-latency Web Audio synthesis.
- Include: a short demo GIF, the live link, run instructions, and an architecture diagram
  (Mermaid) showing camera → HandLandmarker → mapping → Tone.js → speakers.
- Keep commit history clean and meaningful (each becomes a potential build-in-public post).

## 14. Deployment
- Static host: Vercel or GitHub Pages. If GitHub Pages, set Vite `base` to the repo name.
- HTTPS is required for `getUserMedia` (Vercel/Pages both provide it).

---
### Notes for the implementing model
- Prefer clarity over cleverness; this repo is read by recruiters.
- Verify the MediaPipe wasm/model URLs actually load before assuming the tracking works.
- Test the full gesture→sound path in a real browser (webcam) — not just that it compiles.
- Don't add a backend, accounts, or analytics. Keep it a clean single-page client app.
