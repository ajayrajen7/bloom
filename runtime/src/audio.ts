// Programmatic audio via Web Audio API.
// No external files needed for M1. Real TTS + SFX files wired in M3+.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  // Resume if suspended (iOS requires user gesture)
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(
  frequency: number,
  duration: number,
  delay = 0,
  type: OscillatorType = "sine",
  volume = 0.35
) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  osc.frequency.value = frequency;
  const start = c.currentTime + delay;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration);
}

// Bright ascending two-note cue
export function playSuccess() {
  tone(523, 0.12);           // C5
  tone(784, 0.25, 0.1);      // G5
}

// Soft low thud — not punishing
export function playError() {
  tone(220, 0.18, 0, "triangle", 0.2);
}

// Four-note ascending arpeggio for activity completion
export function playCelebration() {
  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  notes.forEach((freq, i) => tone(freq, 0.3, i * 0.14));
}

// Short tap feedback for UI buttons
export function playTap() {
  tone(880, 0.08, 0, "sine", 0.2);
}
