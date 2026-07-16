// Canvas overlay: mirrored hand skeletons, an Action Blue glow while
// playing, note labels, and the video→screen coordinate mapper.

import { makeCoverMapper } from './geometry.js';

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17], // palm edge
];

const FINGERTIPS = new Set([4, 8, 12, 16, 20]);

const IDLE_COLOR = 'rgba(255, 255, 255, 0.85)';
const PLAYING_COLOR = '#2b7fff';

// Wrap the pure cover-crop mapper with this frame's DOM dimensions. The
// math lives in ./geometry.js so it can be tested without a real <video>.
export function makeMapper(video, canvas) {
  return makeCoverMapper({
    displayW: canvas.clientWidth,
    displayH: canvas.clientHeight,
    videoW: video.videoWidth || canvas.clientWidth,
    videoH: video.videoHeight || canvas.clientHeight,
  });
}

// Draw the visible (cover-cropped) region of the video, mirrored, onto
// an arbitrary canvas — used by the recorder to composite frames.
export function drawVideoCover(ctx, video, width, height) {
  const videoW = video.videoWidth;
  const videoH = video.videoHeight;
  if (!videoW || !videoH) return;

  const scale = Math.max(width / videoW, height / videoH);
  const cropW = width / scale;
  const cropH = height / scale;
  const cropX = (videoW - cropW) / 2;
  const cropY = (videoH - cropH) / 2;

  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, width, height);
  ctx.restore();
}

export function resizeCanvas(canvas, video) {
  // Cap the overlay's pixel density: glow lines don't need retina
  // resolution, and 2x DPR quadruples every canvas operation.
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = video.clientWidth;
  const height = video.clientHeight;
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

export function clearCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

// playing widens the glow with amplitude; highlightTips are the
// landmark indices of pressed fingers, drawn as keycap dots.
export function drawHand(canvas, landmarks, map, playing, amplitude = 0, highlightTips = []) {
  const ctx = canvas.getContext('2d');
  const color = playing ? PLAYING_COLOR : IDLE_COLOR;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = playing ? 3 : 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (playing) {
    ctx.shadowColor = PLAYING_COLOR;
    ctx.shadowBlur = 14 + amplitude * 22;
  }

  ctx.beginPath();
  for (const [from, to] of CONNECTIONS) {
    const a = map(landmarks[from]);
    const b = map(landmarks[to]);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  // One blurred stroke for the whole skeleton is fine; blurred fills
  // for 21 individual joints are not — shadow off from here.
  ctx.shadowBlur = 0;

  for (let i = 0; i < landmarks.length; i++) {
    const p = map(landmarks[i]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, FINGERTIPS.has(i) ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pressed fingers get a bright keycap dot — layered circles fake
  // the glow without shadowBlur.
  for (const tipIndex of highlightTips) {
    const p = map(landmarks[tipIndex]);
    ctx.fillStyle = 'rgba(43, 127, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PLAYING_COLOR;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Frosted-glass style pill floating above a fingertip.
export function drawLabel(canvas, point, map, text) {
  const ctx = canvas.getContext('2d');
  const p = map(point);

  ctx.save();
  ctx.font = '500 18px "Space Mono", monospace';
  const textWidth = ctx.measureText(text).width;
  const padX = 14;
  const pillWidth = textWidth + padX * 2;
  const pillHeight = 36;
  const x = Math.min(Math.max(p.x - pillWidth / 2, 8), map.width - pillWidth - 8);
  const y = Math.max(p.y - 64, 8);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, pillWidth, pillHeight, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + pillHeight / 2 + 1);
  ctx.restore();
}
