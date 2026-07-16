// Pure geometry/math the instrument runs on — no DOM, no MediaPipe — so
// the tricky bits (coordinate mapping, the slide-mode window, joint
// angles) can be unit-tested in isolation from the render loop.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// object-fit: cover shows the video as a center crop. Landmarks are
// normalized to the FULL camera frame; this returns a mirrored
// point→pixel mapper so the overlay stays glued to the hand at any
// window/camera aspect ratio. `map.width`/`map.height` expose the
// display size for callers that clamp to the viewport.
export function makeCoverMapper({ displayW, displayH, videoW, videoH }) {
  const scale = Math.max(displayW / videoW, displayH / videoH);
  const cropW = displayW / scale;
  const cropH = displayH / scale;
  const cropX = (videoW - cropW) / 2;
  const cropY = (videoH - cropH) / 2;

  const map = (point) => ({
    x: displayW - (point.x * videoW - cropX) * scale, // mirrored
    y: (point.y * videoH - cropY) * scale,
  });
  map.width = displayW;
  map.height = displayH;
  return map;
}

// Slide mode: map a normalized palm-x (0..1) to a window start index.
// Only the central band [margin, 1-margin] drives the full range, so
// the lowest/highest windows are reachable without pushing the hand to
// the frame edge — where the outer fingers would leave the frame and
// stop tracking. `prev` (the last base for this hand, or null) adds
// hysteresis so the window doesn't flicker at a boundary.
export function slideWindowBase(raw, prev, { scaleLength, handSpan, margin }) {
  const span = 1 - 2 * margin;
  const x = clamp((raw - margin) / span, 0, 1);
  const maxBase = Math.max(0, scaleLength - handSpan);
  const pos = x * (maxBase + 1);
  let next = Math.min(maxBase, Math.floor(pos));
  if (prev != null && next !== prev && Math.abs(pos - (prev + 0.5)) < 0.7) next = prev;
  return next;
}

// Angle at `joint` between the directions to `a` and `b`, in degrees.
// Measured in 3D, so it responds only to real bending of the finger —
// not to hand tilt or distance from the camera.
export function jointAngle(a, joint, b) {
  const v1 = { x: a.x - joint.x, y: a.y - joint.y, z: a.z - joint.z };
  const v2 = { x: b.x - joint.x, y: b.y - joint.y, z: b.z - joint.z };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const norm = Math.hypot(v1.x, v1.y, v1.z) * Math.hypot(v2.x, v2.y, v2.z);
  const cos = clamp(dot / (norm || 1), -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
}
