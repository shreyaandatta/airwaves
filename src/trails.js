// Neon trails: a fading glow ribbon that follows whichever fingertip
// is playing. The neon look comes from three layered strokes (wide
// translucent halo → tight halo → white core) — deliberately NO canvas
// shadowBlur, which is far too expensive to run per segment per frame.

const DURATION_MS = 900;
const REDUCED_DURATION_MS = 350;
// A jump in time or space starts a new stroke instead of drawing a
// long straight connector (e.g. releasing and re-pinching elsewhere).
const GAP_MS = 120;
const GAP_PX = 120;
// Decimation: skip points that barely moved, and cap the buffer so a
// long hold can't grow the per-frame stroke count.
const MIN_STEP_PX = 4;
const MAX_POINTS = 48;

const PASSES = [
  { width: 14, alpha: 0.2, color: '#2b7fff', additive: true },
  { width: 7, alpha: 0.4, color: '#2b7fff', additive: true },
  { width: 2.5, alpha: 0.9, color: '#ffffff', additive: false },
];

export class TrailField {
  constructor() {
    this.trails = new Map(); // key -> [{x, y, t, newStroke}]
    this.duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? REDUCED_DURATION_MS
      : DURATION_MS;
  }

  // Call every frame a fingertip is actively playing.
  push(key, x, y, now) {
    let points = this.trails.get(key);
    if (!points) {
      points = [];
      this.trails.set(key, points);
    }
    const last = points[points.length - 1];
    if (last) {
      const jump = Math.hypot(x - last.x, y - last.y);
      if (jump < MIN_STEP_PX && now - last.t < GAP_MS) return; // barely moved
      points.push({ x, y, t: now, newStroke: now - last.t > GAP_MS || jump > GAP_PX });
    } else {
      points.push({ x, y, t: now, newStroke: true });
    }
    if (points.length > MAX_POINTS) points.splice(0, points.length - MAX_POINTS);
  }

  step(ctx, now) {
    for (const [key, points] of this.trails) {
      const cutoff = now - this.duration;
      let firstAlive = 0;
      while (firstAlive < points.length && points[firstAlive].t < cutoff) firstAlive++;
      if (firstAlive > 0) points.splice(0, firstAlive);
      if (points.length < 2) {
        if (points.length === 0) this.trails.delete(key);
        continue;
      }

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const pass of PASSES) {
        ctx.globalCompositeOperation = pass.additive ? 'lighter' : 'source-over';
        ctx.strokeStyle = pass.color;
        for (let i = 1; i < points.length; i++) {
          const p = points[i];
          if (p.newStroke) continue;
          const life = 1 - (now - p.t) / this.duration; // 1 = fresh, 0 = gone
          ctx.globalAlpha = pass.alpha * life;
          ctx.lineWidth = pass.width * (0.35 + 0.65 * life);
          ctx.beginPath();
          ctx.moveTo(points[i - 1].x, points[i - 1].y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  clear() {
    this.trails.clear();
  }
}
