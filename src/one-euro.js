// Adaptive low-pass ("One Euro") filter: heavy smoothing when the input
// is still (kills jitter), light smoothing when it moves fast (kills
// lag). Strictly better than a fixed-alpha EMA for pointing input.
// Pure and DOM-free so it can be unit-tested in isolation.
// Reference: Casiez, Roussel & Vogel, CHI 2012.

export const MIN_CUTOFF = 1.5; // Hz — lower = smoother at rest
export const BETA = 0.25; // speed coefficient — higher = snappier in motion
export const DERIVATIVE_CUTOFF = 1.0;

function smoothingAlpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuroFilter {
  constructor() {
    this.value = null;
    this.derivative = 0;
  }

  filter(next, dt) {
    if (this.value === null) {
      this.value = next;
      return next;
    }
    const rawDerivative = (next - this.value) / dt;
    const dAlpha = smoothingAlpha(DERIVATIVE_CUTOFF, dt);
    this.derivative += dAlpha * (rawDerivative - this.derivative);

    const cutoff = MIN_CUTOFF + BETA * Math.abs(this.derivative);
    const alpha = smoothingAlpha(cutoff, dt);
    this.value += alpha * (next - this.value);
    return this.value;
  }
}
