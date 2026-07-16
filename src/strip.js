// Scale strip: an always-on lane bar showing every note of the current
// scale, so the player always knows what they're playing. Lanes light
// up as they sound; song mode adds a pulsing target on top, and lanes
// outside the fingers' reach sit dimmed.

// perOctave adds a visual seam where each octave starts.
export function renderStrip(container, notes, perOctave = null) {
  container.innerHTML = '';
  for (let i = 0; i < notes.length; i++) {
    const lane = document.createElement('div');
    lane.className = 'lane';
    if (perOctave && i > 0 && i % perOctave === 0) lane.classList.add('octave-start');
    const label = document.createElement('span');
    label.textContent = notes[i].name;
    lane.appendChild(label);
    container.appendChild(lane);
  }
}

// state: { playingIndices, targetIndex, coveredRanges }
// coveredRanges: [start, end) windows the fingers can currently reach
// (one per hand in slide mode, one overall in fixed mode). Lanes
// outside every window are dimmed.
export function updateStrip(container, state) {
  const { playingIndices = [], targetIndex = null, coveredRanges = null } = state;
  const playing = new Set(playingIndices);
  const lanes = container.children;
  for (let i = 0; i < lanes.length; i++) {
    const covered =
      coveredRanges === null || coveredRanges.some(([start, end]) => i >= start && i < end);
    lanes[i].classList.toggle('playing', playing.has(i));
    lanes[i].classList.toggle('target', targetIndex === i);
    lanes[i].classList.toggle('dimmed', !covered);
  }
}

// Brief blink when a song note registers — makes repeated notes
// (sol sol…) visibly count even though the target doesn't move.
export function flashLane(container, index) {
  const lane = container.children[index];
  if (!lane) return;
  lane.classList.add('hit');
  setTimeout(() => lane.classList.remove('hit'), 250);
}
