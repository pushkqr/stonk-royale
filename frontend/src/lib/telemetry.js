import { reportTelemetry } from "./api";

/**
 * Measures how the chart is actually running and reports it periodically.
 *
 * This exists because "it lagged for a bit" cost an evening of guessing. Frame timing only
 * exists in the browser, so the server can never know a chart is stuttering unless the
 * client says so.
 *
 * The median is what the round felt like; the worst frame and the count of long ones are
 * where a garbage-collection stall shows up, and they are the numbers that actually matter.
 */
const FLUSH_MS = 15_000;

/** Past this, a frame is not a dropped frame — it is a visible hitch. */
const LONG_FRAME_MS = 50;

/**
 * A ceiling on the sample buffer. Fifteen seconds on a 180Hz panel is ~2,700 frames, and
 * flush copies the lot to sort it — measurement should not be adding to the churn it exists
 * to measure. Sampling the most recent frames loses nothing: a stall lands in the window
 * either way.
 */
const MAX_SAMPLES = 600;

/** Frames to time when working out the panel's refresh interval. */
const PROBE_FRAMES = 10;

let refreshMs = 0;

/**
 * Times a short burst of raw animation frames to learn the display's interval.
 *
 * Deliberately not derived from the chart's own frame deltas: the chart loop parks when
 * settled, so its timing reflects match activity rather than the display alone. Without
 * this the median is unreadable — 16.7ms means "perfect" on a 60Hz screen and "dropping half
 * its frames" on a 120Hz one.
 */
function probeRefresh() {
  let seen = 0;
  let first = 0;
  const step = (at) => {
    if (!first) first = at;
    seen += 1;
    if (seen <= PROBE_FRAMES) {
      requestAnimationFrame(step);
      return;
    }
    refreshMs = (at - first) / PROBE_FRAMES;
  };
  requestAnimationFrame(step);
}

const frames = new Float64Array(MAX_SAMPLES);
let frameCount = 0;
let writeIndex = 0;
let lastFrameAt = 0;
let context = null;
let timer = null;

function flush() {
  const count = Math.min(frameCount, MAX_SAMPLES);
  if (count < 10 || !context) {
    frameCount = 0;
    writeIndex = 0;
    return;
  }

  const samples = Array.from(frames.subarray(0, count));
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const worst = samples[samples.length - 1];
  const longFrames = samples.filter((ms) => ms > LONG_FRAME_MS).length;

  reportTelemetry({
    matchCode: context.matchCode,
    // Coarse on purpose: enough to tell a phone from a laptop, not enough to fingerprint.
    platform: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop",
    viewportWidth: window.innerWidth,
    dpr: window.devicePixelRatio || 1,
    medianFrameMs: median,
    refreshMs,
    worstFrameMs: worst,
    longFrames,
    points: context.points,
  });

  frameCount = 0;
  writeIndex = 0;
}

export const telemetry = {
  /** Called once per drawn frame, from the chart's own loop. */
  frame(points) {
    const now = performance.now();
    if (lastFrameAt) {
      const delta = now - lastFrameAt;
      // A tab that was hidden produces one enormous gap that is not a stall.
      if (delta < 2000) {
        frames[writeIndex] = delta;
        writeIndex = (writeIndex + 1) % MAX_SAMPLES;
        frameCount += 1;
      }
      if (context) context.points = points;
    }
    lastFrameAt = now;
  },

  start(matchCode) {
    context = { matchCode, points: 0 };
    lastFrameAt = 0;
    probeRefresh();
    clearInterval(timer);
    timer = setInterval(flush, FLUSH_MS);
  },

  stop() {
    clearInterval(timer);
    timer = null;
    context = null;
    frameCount = 0;
    writeIndex = 0;
    lastFrameAt = 0;
    refreshMs = 0;
  },
};
