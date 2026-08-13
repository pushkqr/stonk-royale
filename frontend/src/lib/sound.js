/**
 * Synthesized so there are no audio files to ship, cache or fail to load.
 *
 * The game sounds like a cheap transistor radio in a newsroom, not a trading terminal.
 * Every cue runs through one shared chain — soft-clipped, then rolled off above 3.2kHz — so
 * the square waves read as a small blown speaker instead of a raw oscillator, and so two
 * cues landing together glue rather than clip.
 *
 * Cues carry information wherever they can: the countdown climbs as the clock falls, a long
 * and a short are opposite pitch sweeps, and a round settles into a major or minor chord
 * depending on whether you made money. You can play with your eyes off the screen.
 *
 * The AudioContext is created lazily on the first cue, by which point the player has
 * already clicked something — browsers refuse to start audio before a gesture.
 */
const STORE_KEY = "stonk:muted";

let ctx = null;
let bus = null;
let noiseBuffer = null;
let muted = localStorage.getItem(STORE_KEY) === "1";

export const isMuted = () => muted;

export function setMuted(next) {
  muted = next;
  localStorage.setItem(STORE_KEY, next ? "1" : "0");
}

/** Soft knee rather than a hard ceiling, so a stacked cue distorts instead of cracking. */
function softClip(amount = 2.2) {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

function audio() {
  // Nothing plays into a tab nobody is looking at.
  if (muted || document.hidden) return null;

  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();

    const shaper = ctx.createWaveShaper();
    shaper.curve = softClip();

    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 3200;
    tone.Q.value = 0.7;

    const master = ctx.createGain();
    master.gain.value = 0.85;

    bus = ctx.createGain();
    bus.connect(shaper).connect(tone).connect(master).connect(ctx.destination);
  }

  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** Exponential ramps cannot reach zero, and a negative target throws. */
const safe = (hz) => Math.max(hz, 1);

/** One shaped note. Two oscillators a few cents apart give it body. */
function note({
  from,
  to = from,
  type = "square",
  duration = 0.12,
  gain = 0.05,
  at = 0,
  detune = 0,
  pan = 0,
}) {
  const c = audio();
  if (!c) return;

  const start = c.currentTime + at;
  const amp = c.createGain();

  // Ramped rather than switched, so notes don't click on and off.
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  if (pan && c.createStereoPanner) {
    const panner = c.createStereoPanner();
    panner.pan.value = pan;
    amp.connect(panner).connect(bus);
  } else {
    amp.connect(bus);
  }

  for (const cents of detune ? [-detune, detune] : [0]) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.detune.value = cents;
    osc.frequency.setValueAtTime(safe(from), start);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(safe(to), start + duration);
    osc.connect(amp);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }
}

/** Filtered noise. Everything percussive — paper, stamps, the crash — is built from this. */
function noise({ duration = 0.12, gain = 0.05, at = 0, from = 1800, to = 400, q = 1 }) {
  const c = audio();
  if (!c) return;

  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.6), c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }

  const start = c.currentTime + at;
  const source = c.createBufferSource();
  source.buffer = noiseBuffer;

  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = q;
  band.frequency.setValueAtTime(safe(from), start);
  band.frequency.exponentialRampToValueAtTime(safe(to), start + duration);

  const amp = c.createGain();
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(band).connect(amp).connect(bus);
  source.start(start);
  source.stop(start + duration + 0.02);
}

const MAJOR = [0, 4, 7, 12];
const MINOR = [0, 3, 7, 12];
const step = (root, semitones) => root * 2 ** (semitones / 12);

export const sound = {
  /**
   * The closing ten seconds. Pitch and weight climb as the clock falls, so the run-in
   * tightens instead of repeating the same beep ten times.
   */
  tick: (secondsLeft = 10) => {
    const closeness = Math.min(Math.max(11 - secondsLeft, 1), 10);
    note({
      from: 620 + closeness * 46,
      duration: 0.035,
      gain: 0.016 + closeness * 0.0028,
    });
    if (secondsLeft <= 3) noise({ duration: 0.05, gain: 0.018, from: 3200, to: 1400, q: 1.4 });
  },

  /** Direction lives in the sweep: a long climbs, a short falls. */
  open: (side = "LONG") =>
    side === "SHORT"
      ? note({ from: 680, to: 300, duration: 0.14, gain: 0.05, detune: 9 })
      : note({ from: 300, to: 720, duration: 0.14, gain: 0.05, detune: 9 }),

  /** Closing green resolves upward; closing red drops away. */
  close: (profit = 0) =>
    profit >= 0
      ? note({ from: 520, to: 780, duration: 0.16, gain: 0.05, detune: 7 })
      : note({ from: 520, to: 240, duration: 0.18, gain: 0.05, detune: 7 }),

  /**
   * The loudest thing in the game, because it is the funniest thing in the game — but only
   * when it happens to you. Somebody else blowing up is news, not slapstick.
   */
  liquidation: (mine = true) => {
    if (!mine) {
      note({ from: 260, to: 90, type: "sawtooth", duration: 0.26, gain: 0.03, pan: 0.4 });
      return;
    }
    noise({ duration: 0.5, gain: 0.075, from: 4200, to: 180, q: 0.6 });
    note({ from: 300, to: 40, type: "sawtooth", duration: 0.5, gain: 0.1, detune: 16 });
    note({ from: 95, to: 45, type: "triangle", duration: 0.4, gain: 0.09, at: 0.06 });
  },

  /** A barker opening the stall: filter sweep up, then the market is live. */
  roundStart: () => {
    noise({ duration: 0.3, gain: 0.03, from: 300, to: 3600, q: 0.8 });
    [0, 7, 12].forEach((semitones, i) =>
      note({
        from: step(262, semitones),
        duration: 0.16,
        gain: 0.05,
        at: i * 0.075,
        detune: 8,
      }),
    );
    note({ from: 700, to: 1050, duration: 0.2, gain: 0.035, at: 0.24, type: "triangle" });
  },

  /** Major if the round paid, minor if it did not. The chord is the scoreboard. */
  settle: (score = 0) => {
    const shape = score >= 0 ? MAJOR : MINOR;
    const root = score >= 0 ? 349 : 294;
    shape.forEach((semitones, i) =>
      note({
        from: step(root, semitones),
        type: "triangle",
        duration: 0.34,
        gain: 0.042,
        at: i * 0.055,
        detune: 6,
      }),
    );
  },

  /** Winning gets the full run; everyone else gets the short, flatter version. */
  finish: (won = false) => {
    const line = won ? [0, 4, 7, 12, 16] : [0, 3, 7];
    line.forEach((semitones, i) =>
      note({
        from: step(won ? 349 : 262, semitones),
        type: "triangle",
        duration: 0.26,
        gain: 0.055,
        at: i * 0.1,
        detune: 7,
      }),
    );
    if (won) noise({ duration: 0.5, gain: 0.03, from: 900, to: 5200, q: 0.7, at: 0.42 });
  },

  /** A card coming off the deck. Paper, not a tone. */
  deal: () => {
    noise({ duration: 0.14, gain: 0.05, from: 2600, to: 900, q: 0.9 });
    note({ from: 180, duration: 0.05, gain: 0.02, type: "triangle", at: 0.02 });
  },

  /** The verdict stamp hitting the card. */
  stamp: (wasTrue = false) => {
    noise({ duration: 0.1, gain: 0.07, from: 1600, to: 260, q: 0.7 });
    note({
      from: wasTrue ? 220 : 150,
      to: wasTrue ? 260 : 90,
      type: "triangle",
      duration: 0.16,
      gain: 0.08,
    });
  },
};
