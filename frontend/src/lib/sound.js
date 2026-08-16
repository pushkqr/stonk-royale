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
let muted = typeof localStorage !== "undefined" ? localStorage.getItem(STORE_KEY) === "1" : false;

export const isMuted = () => muted;

export function setMuted(next) {
  muted = next;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORE_KEY, next ? "1" : "0");
  }
}

export function toggle() {
  setMuted(!muted);
  return muted;
}

// Auto-unlock AudioContext on first gesture anywhere on screen
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    } else if (!ctx && !muted) {
      audio();
    }
    window.removeEventListener("click", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
  };

  window.addEventListener("click", unlockAudio, { passive: true });
  window.addEventListener("touchstart", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio, { passive: true });
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
  if (muted || (typeof document !== "undefined" && document.hidden)) return null;

  if (!ctx) {
    const Ctor = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;
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

  if (ctx.state === "suspended") ctx.resume().catch(() => {});
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
  gain = 0.08,
  at = 0,
  detune = 0,
}) {
  const a = audio();
  if (!a) return;

  const start = a.currentTime + at;
  const stop = start + duration;

  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, stop);
  g.connect(bus);

  const make = (drift) => {
    const osc = a.createOscillator();
    osc.type = type;
    osc.detune.value = drift;
    osc.frequency.setValueAtTime(safe(from), start);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(safe(to), stop);
    osc.connect(g);
    osc.start(start);
    osc.stop(stop);
  };

  make(0);
  if (detune !== 0) make(detune);
}

/** Filtered white noise. Reuses one buffer rather than allocating for every whoosh. */
function noise({
  duration = 0.15,
  gain = 0.06,
  from = 1800,
  to = from,
  q = 1.4,
  at = 0,
  type = "bandpass",
}) {
  const a = audio();
  if (!a) return;

  if (!noiseBuffer) {
    noiseBuffer = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }

  const start = a.currentTime + at;
  const stop = start + duration;

  const src = a.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;

  const filter = a.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(safe(from), start);
  if (to !== from) filter.frequency.exponentialRampToValueAtTime(safe(to), stop);

  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, stop);

  src.connect(filter).connect(g).connect(bus);
  src.start(start);
  src.stop(stop);
}

let lastChatterAt = 0;
const CHATTER_GAP_MS = 250;

// --- background tension generator (BGM) -----------------------------------
let bgmInterval = null;
let bgmMode = "normal";
let bgmActive = false;

function playBgmBeat() {
  if (muted || (typeof document !== "undefined" && document.hidden) || !bgmActive) return;
  const a = audio();
  if (!a || !bus) return;

  const isUrgent = bgmMode === "urgent";
  const now = a.currentTime;

  // Sub pulse & soft rhythmic sweep
  const osc = a.createOscillator();
  const gain = a.createGain();
  const filter = a.createBiquadFilter();

  osc.type = isUrgent ? "sawtooth" : "sine";
  osc.frequency.setValueAtTime(isUrgent ? 82.4 : 55.0, now);
  if (isUrgent) {
    osc.frequency.exponentialRampToValueAtTime(110.0, now + 0.15);
  }

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(isUrgent ? 600 : 250, now);
  filter.Q.value = isUrgent ? 2.5 : 1.0;

  const peakGain = isUrgent ? 0.032 : 0.018;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(peakGain, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (isUrgent ? 0.28 : 0.45));

  osc.connect(filter).connect(gain).connect(bus);
  osc.start(now);
  osc.stop(now + (isUrgent ? 0.3 : 0.5));
}

export const bgm = {
  start: (mode = "normal") => {
    bgmActive = true;
    bgmMode = mode;
    if (bgmInterval) clearInterval(bgmInterval);
    const intervalMs = mode === "urgent" ? 500 : 750;
    playBgmBeat();
    bgmInterval = setInterval(playBgmBeat, intervalMs);
  },

  setUrgent: (isUrgent) => {
    const nextMode = isUrgent ? "urgent" : "normal";
    if (bgmMode === nextMode && bgmInterval) return;
    bgmMode = nextMode;
    if (bgmActive) {
      if (bgmInterval) clearInterval(bgmInterval);
      const intervalMs = nextMode === "urgent" ? 500 : 750;
      playBgmBeat();
      bgmInterval = setInterval(playBgmBeat, intervalMs);
    }
  },

  stop: () => {
    bgmActive = false;
    if (bgmInterval) {
      clearInterval(bgmInterval);
      bgmInterval = null;
    }
  },

  isActive: () => bgmActive,
  getMode: () => bgmMode,
};

export const sound = {
  isMuted,
  setMuted,
  toggle,
  bgm,

  /**
   * Final ten seconds of a trading round. Climbs one semitone per second so urgency is
   * legible across the room.
   */
  tick: (secondsLeft) => {
    const step = Math.max(1, Math.min(10, secondsLeft));
    const hz = 440 * 2 ** ((10 - step) / 12);
    note({
      from: hz,
      type: "sine",
      duration: step === 1 ? 0.22 : 0.06,
      gain: step === 1 ? 0.12 : 0.06,
      detune: 4,
    });
  },

  /** Long or short position opened. */
  open: (side) => {
    const isLong = side === "LONG";
    note({
      from: isLong ? 260 : 680,
      to: isLong ? 680 : 260,
      type: "triangle",
      duration: 0.12,
      gain: 0.07,
      detune: 8,
    });
    noise({
      duration: 0.1,
      gain: 0.03,
      from: isLong ? 800 : 3400,
      to: isLong ? 3400 : 800,
    });
  },

  /** Instant trade feedback click */
  trade: (isLong = true) => {
    note({
      from: isLong ? 440 : 330,
      to: isLong ? 660 : 220,
      type: "sine",
      duration: 0.06,
      gain: 0.05,
    });
  },

  /** Position closed. Chord color reflects whether it was green or red. */
  close: (pnl) => {
    const profit = pnl >= 0;
    const base = profit ? 523.25 : 370; // C5 vs F#4
    const third = profit ? 659.25 : 440; // E5 vs A4
    const fifth = profit ? 783.99 : 554.37; // G5 vs C#5
    note({ from: base, duration: 0.2, gain: 0.05 });
    note({ from: third, duration: 0.22, gain: 0.045, at: 0.02 });
    note({ from: fifth, duration: 0.28, gain: 0.04, at: 0.04 });
  },

  /**
   * You blew up. The loudest, ugliest cue in the game: an oscillator dive and low-frequency
   * noise, cutting hard into the soft-clipper.
   */
  liquidation: (isMine = false) => {
    if (!isMine) {
      // Somebody else blew up. Distinct, but quieter so it does not startle the player.
      note({ from: 180, to: 65, type: "sawtooth", duration: 0.35, gain: 0.06 });
      noise({ duration: 0.28, gain: 0.04, from: 1400, to: 160, q: 2 });
      return;
    }
    note({ from: 320, to: 45, type: "sawtooth", duration: 0.55, gain: 0.18, detune: 12 });
    noise({ duration: 0.5, gain: 0.14, from: 2400, to: 90, q: 2.2 });
    // Sub rumble that outlasts the noise.
    note({ from: 60, to: 30, type: "sine", duration: 0.7, gain: 0.15, at: 0.08 });
  },

  /** The opening bell of a round. */
  roundStart: () => {
    note({ from: 880, type: "triangle", duration: 0.3, gain: 0.07, detune: 6 });
    note({ from: 1320, type: "triangle", duration: 0.2, gain: 0.035, at: 0.04 });
  },

  /**
   * The score arriving at the intermission. A rising arpeggio for profit, a slow descending
   * pair of notes for a loss.
   */
  settle: (totalScore) => {
    if (totalScore >= 0) {
      [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) =>
        note({
          from: hz,
          type: "triangle",
          duration: 0.18,
          gain: 0.045,
          at: i * 0.07,
          detune: 4,
        }),
      );
    } else {
      note({ from: 311.13, to: 277.18, type: "triangle", duration: 0.26, gain: 0.06 });
      note({ from: 233.08, to: 207.65, type: "triangle", duration: 0.34, gain: 0.055, at: 0.12 });
    }
  },

  /** Match finished. Victory fanfare or a muted resolution. */
  finish: (won = false) => {
    const scale = won
      ? [523.25, 659.25, 783.99, 1046.5, 1318.51]
      : [392.0, 349.23, 311.13, 261.63];
    scale.forEach((hz, i) =>
      note({
        from: hz,
        type: "triangle",
        duration: won ? 0.28 : 0.35,
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

  /**
   * A bulletin coming off the wire: teletype keys, then the bell.
   */
  news: () => {
    for (let i = 0; i < 3; i += 1) {
      noise({ duration: 0.03, gain: 0.028, from: 3000, to: 2200, q: 2.4, at: i * 0.045 });
    }
    note({ from: 1560, type: "triangle", duration: 0.22, gain: 0.045, at: 0.14, detune: 5 });
    note({ from: 2340, type: "triangle", duration: 0.16, gain: 0.02, at: 0.14 });
  },

  /**
   * Somebody said something. Deliberately the quietest cue in the game.
   */
  chatter: () => {
    const now = Date.now();
    if (now - lastChatterAt < CHATTER_GAP_MS) return;
    lastChatterAt = now;
    noise({ duration: 0.025, gain: 0.022, from: 2600, to: 1700, q: 3 });
  },

  /**
   * Somebody readied up in the briefing.
   */
  ready: (fraction = 0) =>
    note({
      from: 440 + fraction * 380,
      type: "triangle",
      duration: 0.09,
      gain: 0.035,
      detune: 5,
    }),

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
