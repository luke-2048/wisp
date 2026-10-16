// Two short sounds, synthesised with Web Audio: no audio files, nothing
// leaves the computer. Soft bells rather than alarms.
// (tauri.conf.json lets WebView2 play them without a click first.)

let context: AudioContext | null = null;

function audio(): AudioContext {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** One note that starts soft, rings and fades out. */
function note(freq: number, start: number, length: number, volume: number, type: OscillatorType) {
  const ctx = audio();
  const at = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

/** A bell: the note plus a quiet overtone. */
function bell(freq: number, start: number, volume: number) {
  note(freq, start, 1.6, volume, 'sine');
  note(freq * 2.01, start, 0.7, volume * 0.25, 'sine');
}

/** Timer over: three rising bells, played twice so you notice. */
export function playTimerEnd() {
  const notes = [659.25, 783.99, 1046.5]; // E5 G5 C6
  for (const round of [0, 1.3]) {
    notes.forEach((freq, i) => bell(freq, round + i * 0.26, 0.22));
  }
}

/** "Fatto!": a quick, bright arpeggio with a sparkle on top. */
export function playDone() {
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => note(freq, i * 0.07, 0.5, 0.16, 'triangle'));
  note(2093, 0.3, 0.7, 0.05, 'sine'); // C7
}
