# Airwaves — Design Review & Improvement Plan (July 2026)

> Companion to [BUILD_SPEC.md](BUILD_SPEC.md) (the original build brief) and
> [README.md](README.md). This doc is the post-build critique and the forward roadmap,
> in three tiers.

---

## 1. Where the project stands

A working, on-device gesture instrument: MediaPipe hand tracking → One Euro smoothing →
PIP bend-angle presses → scale quantization → Tone.js synthesis, with a tutorial, six
guided songs, slide mode, clip recording, and unit tests over the pure math modules
(~2,100 lines of source, 4 test files).

## 2. Critique — honest assessment

**What's genuinely strong**
- The engineering notes in the README read like a real postmortem: bend-angle vs
  fingertip-distance, One Euro vs EMA, cover-crop mapping. This is exactly what
  interviewers probe for — keep it.
- Pure, DOM-free modules (`geometry.js`, `one-euro.js`, `scales.js`, `songs.js`) with
  Vitest coverage. Rare in student projects.
- Real product decisions ("no camera mode was cut, and here's why") show judgment, not
  just output.

**What's holding it back**
1. **It does not exist to a recruiter.** No git repo, no GitHub, no live URL, no demo
   GIF — the README literally says *"link goes here."* A project that can't be clicked
   is a project that didn't happen. This is the only critique that matters until fixed.
2. **Latency is claimed, not measured.** "Feels instant" is a vibe; a number
   ("median 43 ms gesture→sound, measured") is a résumé line.
3. **No CI.** Tests exist but nothing runs them automatically; a green badge is cheap
   credibility.
4. **Vanilla JS everywhere.** Deliberate and defensible, but zero TypeScript in the
   whole portfolio is a keyword gap for 2026-27 internship filters.
5. **`main.js` is the god-object risk** — session lifecycle + per-frame loop + wiring in
   one file. Fine at this size, but it's the file that will rot first.
6. **Desktop-Chrome-only** is stated but unenforced — no graceful message on
   unsupported browsers/devices.

## 3. Improvements — three tiers

### Tier 1 — Ship it (days; do before anything else)
- [ ] `git init`, meaningful commit history, push to GitHub (public).
- [ ] Deploy `dist/` to Vercel; put the live URL in the README and your LinkedIn.
- [ ] Record the demo GIF (10–15 s: curl fingers → notes + trails) and a 30–60 s
      LinkedIn video with sound.
- [ ] GitHub Actions: run `npm test` + `npm run build` on push; badge in README.
- [ ] Unsupported-environment banner (no webcam / no `getUserMedia` / mobile) instead of
      a silent failure.

### Tier 2 — Depth (1–2 weeks; makes interviews easier)
- [ ] **Latency HUD** (`?hud=1`): measure camera-frame→audio-trigger time, show
      median/p95; publish the numbers in the README.
- [ ] **Web MIDI output** — let Airwaves drive a real DAW/synth as a controller. Turns
      a toy into an instrument, and "implemented a Web MIDI controller" is a strong line.
- [ ] **Velocity from curl speed** (not just hand height) — more expressive, and a nice
      derivative-of-filtered-signal story.
- [ ] Migrate the pure modules (`geometry`, `one-euro`, `scales`, `songs`) to
      **TypeScript**; keep the DOM code JS if you like. Cheap, high signal.
- [ ] Extract `one-euro.js` into a tiny **published npm package** with docs + tests —
      "npm author" is a real differentiator.

### Tier 3 — Flagship (stretch; only after Tiers 1–2)
- [ ] **Loop station**: record a phrase, overdub layers, per-loop mute — gesture-only
      live looping is a spectacular demo video.
- [ ] **Two-player jam over WebRTC** — two browsers, one shared audio space; showcases
      realtime networking.
- [ ] **Custom gesture mapping** — let users bind gestures to instruments/effects, using
      the same KNN-over-landmarks idea Signbridge uses (cross-project reuse story).
- [ ] Installable **PWA** + offline model caching.

## 4. Definition of done for "portfolio-ready"
Live URL ✓ · demo GIF in README ✓ · CI badge ✓ · measured latency number ✓ ·
a 60-second video posted on LinkedIn ✓.
