// Recording: composites the mirrored webcam + overlay + a promotional
// watermark onto an offscreen canvas each frame, muxes it with the
// synth audio, and downloads a shareable .webm clip.

import { drawVideoCover } from './draw.js';

const MAX_WIDTH = 1280;
const WATERMARK = 'AIRWAVES · play the air';

let recorder = null;
let chunks = [];
let recCanvas = null;
let recCtx = null;
let timerId = null;

export function isRecording() {
  return recorder !== null && recorder.state === 'recording';
}

export function startRecording(video, overlay, audioStream, onTick) {
  const scale = Math.min(1, MAX_WIDTH / overlay.clientWidth);
  recCanvas = document.createElement('canvas');
  recCanvas.width = Math.round(overlay.clientWidth * scale);
  recCanvas.height = Math.round(overlay.clientHeight * scale);
  recCtx = recCanvas.getContext('2d');

  const stream = recCanvas.captureStream(30);
  if (audioStream) {
    for (const track of audioStream.getAudioTracks()) stream.addTrack(track);
  }

  const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm'].find((type) =>
    MediaRecorder.isTypeSupported(type)
  );
  chunks = [];
  recorder = new MediaRecorder(stream, { mimeType });
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start(1000);

  const startedAt = Date.now();
  timerId = setInterval(() => onTick(Math.floor((Date.now() - startedAt) / 1000)), 500);
}

// Called from the main loop each frame while recording.
export function captureFrame(video, overlay) {
  if (!isRecording()) return;
  const w = recCanvas.width;
  const h = recCanvas.height;

  drawVideoCover(recCtx, video, w, h);
  recCtx.fillStyle = 'rgba(66, 97, 136, 0.35)'; // sky tint, as on screen
  recCtx.fillRect(0, 0, w, h);
  recCtx.drawImage(overlay, 0, 0, w, h);
  drawWatermark(recCtx, w, h);
}

function drawWatermark(ctx, w, h) {
  ctx.save();
  ctx.font = '700 16px "Space Mono", monospace';
  const textWidth = ctx.measureText(WATERMARK).width;
  const padX = 12;
  const pillW = textWidth + padX * 2;
  const pillH = 32;
  const x = w - pillW - 16;
  const y = h - pillH - 16;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.roundRect(x, y, pillW, pillH, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.textBaseline = 'middle';
  ctx.fillText(WATERMARK, x + padX, y + pillH / 2 + 1);
  ctx.restore();
}

export function stopRecording() {
  if (!recorder) return;
  clearInterval(timerId);
  const finished = recorder;
  finished.onstop = () => {
    const blob = new Blob(chunks, { type: finished.mimeType || 'video/webm' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `airwaves-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.webm`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    chunks = [];
  };
  finished.stop();
  recorder = null;
  recCanvas = null;
  recCtx = null;
}
