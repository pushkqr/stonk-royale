/**
 * Synthesized so there are no audio files to ship, cache or fail to load.
 *
 * The AudioContext is created lazily on the first cue, by which point the player has
 * already clicked something — browsers refuse to start audio before a gesture.
 */
const STORE_KEY = "stonk:muted";

let context = null;
let muted = localStorage.getItem(STORE_KEY) === "1";

export const isMuted = () => muted;

export function setMuted(next) {
  muted = next;
  localStorage.setItem(STORE_KEY, next ? "1" : "0");
}

function audio() {
  if (muted) return null;
  if (!context) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  if (context.state === "suspended") context.resume();
  return context;
}

/** One shaped note. Everything below is built out of these. */
function note({ from, to = from, type = "square", duration = 0.12, gain = 0.05, at = 0 }) {
  const ctx = audio();
  if (!ctx) return;

  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + duration);

  // Ramped rather than switched, so notes don't click on and off.
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export const sound = {
  /** Last ten seconds of a round. Deliberately small — it fires ten times. */
  tick: () => note({ from: 880, duration: 0.04, gain: 0.025 }),

  open: () => note({ from: 440, to: 700, duration: 0.09, gain: 0.045 }),

  close: () => note({ from: 700, to: 440, duration: 0.09, gain: 0.045 }),

  /** The loudest thing in the game, because it is the funniest thing in the game. */
  liquidation: () => {
    note({ from: 320, to: 60, type: "sawtooth", duration: 0.5, gain: 0.11 });
    note({ from: 150, to: 40, type: "square", duration: 0.55, gain: 0.06, at: 0.04 });
  },

  roundStart: () => {
    note({ from: 240, to: 620, duration: 0.22, gain: 0.06 });
    note({ from: 480, to: 940, duration: 0.22, gain: 0.035, at: 0.06 });
  },

  settle: () => {
    note({ from: 520, duration: 0.14, gain: 0.05 });
    note({ from: 780, duration: 0.18, gain: 0.05, at: 0.12 });
  },

  finish: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      note({ from: f, type: "triangle", duration: 0.22, gain: 0.06, at: i * 0.11 }),
    );
  },
};
