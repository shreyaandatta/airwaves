// Interactive tutorial: watches the live finger state each frame and
// checks off steps as the user actually performs them. Skippable at
// any time; never blocks the instrument.

const STEPS = [
  {
    text: 'Show your hands to the camera',
    check: (s) => s.handsSeen > 0,
  },
  {
    text: 'Lightly curl a finger — like pressing a piano key',
    check: (s) => s.pressedCount > 0,
  },
  {
    text: 'Play three different notes — each finger is its own key',
    init: (s, m) => { m.notes = new Set(); },
    check: (s, m) => {
      for (const name of s.noteNames) m.notes.add(name);
      return m.notes.size >= 3;
    },
  },
  {
    text: 'Curl two fingers at once — that’s a chord',
    check: (s) => s.pressedCount >= 2,
  },
];

const DONE_TEXT = "You're playing! Try a song from the dock below.";
const STEP_SETTLE_MS = 700; // pause on the checkmark before advancing

export class Tutorial {
  constructor(root) {
    this.root = root;
    this.textEl = root.querySelector('.tutorial-text');
    this.dotsEl = root.querySelector('.tutorial-dots');
    this.active = false;
    root.querySelector('.tutorial-skip').addEventListener('click', () => this.stop());
  }

  start() {
    this.active = true;
    this.step = 0;
    this.memo = {};
    this.settleUntil = 0;
    this.root.classList.remove('hidden');
    this.renderStep();
  }

  stop() {
    this.active = false;
    this.root.classList.add('hidden');
  }

  renderStep(done = false) {
    this.textEl.textContent = done ? DONE_TEXT : STEPS[this.step].text;
    this.dotsEl.innerHTML = '';
    for (let i = 0; i < STEPS.length; i++) {
      const dot = document.createElement('span');
      dot.className = 'dot' + (i < this.step || done ? ' done' : i === this.step ? ' current' : '');
      this.dotsEl.appendChild(dot);
    }
  }

  // Called every frame with { handsSeen, pressedCount, noteNames }.
  observe(state) {
    if (!this.active) return;
    const now = performance.now();
    if (this.settleUntil) {
      if (now < this.settleUntil) return;
      this.settleUntil = 0;
      this.step += 1;
      if (this.step >= STEPS.length) {
        this.renderStep(true);
        setTimeout(() => this.stop(), 3000);
        this.step = STEPS.length - 1;
        this.active = false;
        return;
      }
      this.memo = {};
      STEPS[this.step].init?.(state, this.memo);
      this.renderStep();
      return;
    }

    if (STEPS[this.step].check(state, this.memo)) {
      this.root.querySelector('.tutorial-card').classList.add('flash');
      setTimeout(() => this.root.querySelector('.tutorial-card').classList.remove('flash'), 400);
      this.settleUntil = now + STEP_SETTLE_MS;
    }
  }
}
