/**
 * Synthesized procedural audio engine — 0KB audio assets, zero network fetches.
 *
 * Architecture:
 * - Master Bus: Soft-clipping shaper -> 3.2kHz lowpass roll-off -> Master Gain -> Destination.
 * - SFX Engine: Procedural oscillators and noise buffers for trade, liquidation, news, etc.
 * - "Wall Street Arcade" BGM Engine:
 *   - 16-step A-minor resonant synth bassline.
 *   - Pentatonic neon arpeggio shimmer with subtle stereo-detune.
 *   - High-frequency crisp ticker rhythm on 8th notes.
 *   - Dynamic tempo & tension scaling: 110 BPM normal -> 135 BPM urgent mode with filter opening.
 *   - Sidechain ducking: Master BGM gain automatically ducks on high-priority SFX.
 *   - Clean lifecycle: Explicit node disconnection on `osc.onended`, zero memory leaks.
 *   - Automatic visibility & mute handling.
 */

const STORE_KEY = "stonk:muted";

// --- Global Audio Graph State ---
let ctx = null;
let bus = null;
let bgmGainNode = null;
let bgmFilterNode = null;
let noiseBuffer = null;
let tickerBuffer = null;
let muted = typeof localStorage !== "undefined" ? localStorage.getItem(STORE_KEY) === "1" : false;

export const isMuted = () => muted;

export function setMuted(next) {
  muted = next;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORE_KEY, next ? "1" : "0");
  }
  if (muted) {
    if (bgmGainNode && ctx) {
      try {
        bgmGainNode.gain.cancelScheduledValues(ctx.currentTime);
        bgmGainNode.gain.setValueAtTime(0, ctx.currentTime);
      } catch {
        // Ignored
      }
    }
  } else {
    if (bgmGainNode && ctx && bgmActive) {
      try {
        bgmGainNode.gain.cancelScheduledValues(ctx.currentTime);
        bgmGainNode.gain.setValueAtTime(0.001, ctx.currentTime);
        bgmGainNode.gain.linearRampToValueAtTime(BGM_BASE_GAIN, ctx.currentTime + 0.1);
      } catch {
        // Ignored
      }
    }
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

  // Document visibility change listener to pause/resume BGM gracefully
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (bgmGainNode && ctx) {
          try {
            bgmGainNode.gain.cancelScheduledValues(ctx.currentTime);
            bgmGainNode.gain.setValueAtTime(0, ctx.currentTime);
          } catch {
            // Ignored
          }
        }
      } else {
        if (ctx && ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
        if (bgmGainNode && ctx && bgmActive && !muted) {
          try {
            bgmGainNode.gain.cancelScheduledValues(ctx.currentTime);
            bgmGainNode.gain.setValueAtTime(0.001, ctx.currentTime);
            bgmGainNode.gain.linearRampToValueAtTime(BGM_BASE_GAIN, ctx.currentTime + 0.1);
          } catch {
            // Ignored
          }
        }
      }
    });
  }
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

    // Dedicated BGM sub-bus with dynamic lowpass filter & sidechain gain
    bgmFilterNode = ctx.createBiquadFilter();
    bgmFilterNode.type = "lowpass";
    bgmFilterNode.frequency.value = 1400;
    bgmFilterNode.Q.value = 1.8;

    bgmGainNode = ctx.createGain();
    bgmGainNode.gain.value = BGM_BASE_GAIN;

    bgmGainNode.connect(bgmFilterNode).connect(bus);
  }

  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Exponential ramps cannot reach zero, and a negative target throws. */
const safe = (hz) => Math.max(hz, 1);

// --- Sidechain Ducking System ---
const BGM_BASE_GAIN = 0.38;

export function duckBgm(duckLevel = 0.25, duration = 0.3) {
  if (!bgmGainNode || !ctx || muted || !bgmActive) return;
  const now = ctx.currentTime;
  try {
    bgmGainNode.gain.cancelScheduledValues(now);
    bgmGainNode.gain.setValueAtTime(bgmGainNode.gain.value, now);
    bgmGainNode.gain.linearRampToValueAtTime(BGM_BASE_GAIN * duckLevel, now + 0.015);
    bgmGainNode.gain.linearRampToValueAtTime(BGM_BASE_GAIN, now + 0.015 + duration);
  } catch {
    // Gracefully handle timing conflicts
  }
}

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
    osc.onended = () => {
      try {
        osc.disconnect();
        g.disconnect();
      } catch {
        // Ignored
      }
    };
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
  src.onended = () => {
    try {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    } catch {
      // Ignored
    }
  };
  src.start(start);
  src.stop(stop);
}

let lastChatterAt = 0;
const CHATTER_GAP_MS = 250;

// --- "Wall Street Arcade" Procedural BGM Engine ---

// Note Frequencies in A-minor & Pentatonic
const NOTE = {
  A1: 55.00,
  C2: 65.41,
  D2: 73.42,
  E2: 82.41,
  F2: 87.31,
  G2: 98.00,
  A2: 110.00,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  G3: 196.00,
  A3: 220.00,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392.00,
  A4: 440.00,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.00,
};

// 16-Step Composition Patterns
const BASS_PATTERN_NORMAL = [
  NOTE.A1, NOTE.A1, NOTE.A2, NOTE.A1,
  NOTE.C2, NOTE.C2, NOTE.D2, NOTE.E2,
  NOTE.A1, NOTE.A1, NOTE.G2, NOTE.A1,
  NOTE.F2, NOTE.E2, NOTE.D2, NOTE.C2,
];

const BASS_PATTERN_URGENT = [
  NOTE.A1, NOTE.A2, NOTE.A1, NOTE.A2,
  NOTE.C2, NOTE.E2, NOTE.D2, NOTE.E2,
  NOTE.A1, NOTE.A2, NOTE.G2, NOTE.A2,
  NOTE.F2, NOTE.G2, NOTE.A2, NOTE.E2,
];

const ARP_PATTERN_NORMAL = [
  NOTE.A3, 0,       NOTE.E4, NOTE.A4,
  NOTE.C4, 0,       NOTE.G4, NOTE.E4,
  NOTE.A3, NOTE.C4, NOTE.D4, NOTE.E4,
  NOTE.G4, NOTE.E4, NOTE.D4, NOTE.C4,
];

const ARP_PATTERN_URGENT = [
  NOTE.A4, NOTE.C5, NOTE.E5, NOTE.A5,
  NOTE.G4, NOTE.E5, NOTE.D5, NOTE.C5,
  NOTE.A4, NOTE.E5, NOTE.G5, NOTE.E5,
  NOTE.D5, NOTE.C5, NOTE.E5, NOTE.G5,
];

// Ticker triggers on 8th notes (steps 0, 2, 4, 6, 8, 10, 12, 14) + syncopations
const TICKER_PATTERN_NORMAL = [
  1, 0, 1, 0,
  1, 0, 1, 0,
  1, 0, 1, 0,
  1, 0, 1, 0,
];

const TICKER_PATTERN_URGENT = [
  1, 0, 1, 1,
  1, 0, 1, 1,
  1, 0, 1, 1,
  1, 1, 1, 1,
];

let bgmActive = false;
let bgmMode = "normal";
let bgmSchedulerTimer = null;
let currentStep = 0;
let nextStepTime = 0;

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;

function scheduleBassNote(freq, time, isUrgent) {
  if (!ctx || !bgmGainNode || !freq) return;
  const duration = isUrgent ? 0.09 : 0.12;
  const stopTime = time + duration;

  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq, time);

  filter.type = "lowpass";
  const startCutoff = isUrgent ? 1400 : 700;
  const endCutoff = isUrgent ? 240 : 120;
  filter.frequency.setValueAtTime(startCutoff, time);
  filter.frequency.exponentialRampToValueAtTime(endCutoff, stopTime);
  filter.Q.value = isUrgent ? 3.5 : 2.0;

  const peakGain = isUrgent ? 0.07 : 0.055;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(peakGain, time + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

  osc.connect(filter).connect(gain).connect(bgmGainNode);

  osc.onended = () => {
    try {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    } catch {
      // Ignored
    }
  };

  osc.start(time);
  osc.stop(stopTime);
}

function scheduleArpNote(freq, time, isUrgent) {
  if (!ctx || !bgmGainNode || !freq) return;
  const duration = isUrgent ? 0.08 : 0.11;
  const stopTime = time + duration;

  const osc = ctx.createOscillator();
  const oscDetune = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, time);

  oscDetune.type = "sine";
  oscDetune.frequency.setValueAtTime(freq, time);
  oscDetune.detune.setValueAtTime(isUrgent ? 8 : 5, time);

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(isUrgent ? 2600 : 1800, time);
  filter.Q.value = 1.2;

  const peakGain = isUrgent ? 0.038 : 0.024;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(peakGain, time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

  osc.connect(filter);
  oscDetune.connect(filter);
  filter.connect(gain).connect(bgmGainNode);

  osc.onended = () => {
    try {
      osc.disconnect();
      oscDetune.disconnect();
      filter.disconnect();
      gain.disconnect();
    } catch {
      // Ignored
    }
  };

  osc.start(time);
  oscDetune.start(time);
  osc.stop(stopTime);
  oscDetune.stop(stopTime);
}

function scheduleTicker(time, isUrgent) {
  if (!ctx || !bgmGainNode) return;
  const duration = 0.018;
  const stopTime = time + duration;

  if (!tickerBuffer) {
    tickerBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const d = tickerBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005));
    }
  }

  const src = ctx.createBufferSource();
  src.buffer = tickerBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(isUrgent ? 5500 : 4200, time);

  const gain = ctx.createGain();
  const peakGain = isUrgent ? 0.028 : 0.016;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(peakGain, time + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

  src.connect(filter).connect(gain).connect(bgmGainNode);

  src.onended = () => {
    try {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    } catch {
      // Ignored
    }
  };

  src.start(time);
  src.stop(stopTime);
}

function scheduleStep(step, time, mode) {
  const isUrgent = mode === "urgent";

  const bassFreq = isUrgent ? BASS_PATTERN_URGENT[step] : BASS_PATTERN_NORMAL[step];
  if (bassFreq) scheduleBassNote(bassFreq, time, isUrgent);

  const arpFreq = isUrgent ? ARP_PATTERN_URGENT[step] : ARP_PATTERN_NORMAL[step];
  if (arpFreq) scheduleArpNote(arpFreq, time, isUrgent);

  const tickerOn = isUrgent ? TICKER_PATTERN_URGENT[step] : TICKER_PATTERN_NORMAL[step];
  if (tickerOn) scheduleTicker(time, isUrgent);
}

function updateBgmFilter(mode) {
  if (!bgmFilterNode || !ctx) return;
  const isUrgent = mode === "urgent";
  const targetFreq = isUrgent ? 3600 : 1500;
  const targetQ = isUrgent ? 2.4 : 1.6;
  try {
    bgmFilterNode.frequency.cancelScheduledValues(ctx.currentTime);
    bgmFilterNode.frequency.linearRampToValueAtTime(targetFreq, ctx.currentTime + 0.3);
    bgmFilterNode.Q.cancelScheduledValues(ctx.currentTime);
    bgmFilterNode.Q.linearRampToValueAtTime(targetQ, ctx.currentTime + 0.3);
  } catch {
    // Ignored
  }
}

function schedulerTick() {
  if (!bgmActive || muted || (typeof document !== "undefined" && document.hidden)) return;
  const a = audio();
  if (!a || !bgmGainNode) return;

  const bpm = bgmMode === "urgent" ? 135 : 110;
  const stepDuration = (60 / bpm) / 4; // 16th note step

  while (nextStepTime < a.currentTime + SCHEDULE_AHEAD_SEC) {
    scheduleStep(currentStep, nextStepTime, bgmMode);
    nextStepTime += stepDuration;
    currentStep = (currentStep + 1) % 16;
  }
}

export const bgm = {
  start: (mode = "normal") => {
    bgmActive = true;
    bgmMode = mode;

    const a = audio();
    if (a) {
      if (bgmGainNode) {
        bgmGainNode.gain.cancelScheduledValues(a.currentTime);
        bgmGainNode.gain.setValueAtTime(bgmGainNode.gain.value || 0.001, a.currentTime);
        bgmGainNode.gain.linearRampToValueAtTime(BGM_BASE_GAIN, a.currentTime + 0.08);
      }
      updateBgmFilter(mode);
      if (nextStepTime < a.currentTime) {
        nextStepTime = a.currentTime + 0.03;
      }
    }

    if (bgmSchedulerTimer) clearInterval(bgmSchedulerTimer);
    schedulerTick();
    bgmSchedulerTimer = setInterval(schedulerTick, LOOKAHEAD_MS);
  },

  setUrgent: (isUrgent) => {
    const nextMode = isUrgent ? "urgent" : "normal";
    if (bgmMode === nextMode) return;
    bgmMode = nextMode;
    if (bgmActive && ctx) {
      updateBgmFilter(nextMode);
    }
  },

  stop: () => {
    bgmActive = false;
    currentStep = 0;
    if (bgmSchedulerTimer) {
      clearInterval(bgmSchedulerTimer);
      bgmSchedulerTimer = null;
    }
    if (bgmGainNode && ctx) {
      try {
        bgmGainNode.gain.cancelScheduledValues(ctx.currentTime);
        bgmGainNode.gain.setValueAtTime(bgmGainNode.gain.value, ctx.currentTime);
        bgmGainNode.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
      } catch {
        // Ignored
      }
    }
  },

  duck: (level = 0.25, duration = 0.3) => {
    duckBgm(level, duration);
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
    duckBgm(0.3, 0.25);
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
    duckBgm(0.35, 0.2);
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
    duckBgm(0.25, 0.35);
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
    duckBgm(0.12, 0.65);
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
    duckBgm(0.2, 0.45);
    note({ from: 880, type: "triangle", duration: 0.3, gain: 0.07, detune: 6 });
    note({ from: 1320, type: "triangle", duration: 0.2, gain: 0.035, at: 0.04 });
  },

  /**
   * The score arriving at the intermission. A rising arpeggio for profit, a slow descending
   * pair of notes for a loss.
   */
  settle: (totalScore) => {
    duckBgm(0.25, 0.4);
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
    duckBgm(0.2, 0.5);
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
    duckBgm(0.25, 0.35);
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
    duckBgm(0.25, 0.3);
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
