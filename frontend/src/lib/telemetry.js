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

const frames = [];
let lastFrameAt = 0;
let context = null;
let timer = null;

function flush() {
  if (frames.length < 10 || !context) {
    frames.length = 0;
    return;
  }

  const sorted = [...frames].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const worst = sorted[sorted.length - 1];
  const longFrames = sorted.filter((ms) => ms > LONG_FRAME_MS).length;

  reportTelemetry({
    matchCode: context.matchCode,
    // Coarse on purpose: enough to tell a phone from a laptop, not enough to fingerprint.
    platform: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop",
    viewportWidth: window.innerWidth,
    dpr: window.devicePixelRatio || 1,
    medianFrameMs: median,
    worstFrameMs: worst,
    longFrames,
    points: context.points,
  });

  frames.length = 0;
}

export const telemetry = {
  /** Called once per drawn frame, from the chart's own loop. */
  frame(points) {
    const now = performance.now();
    if (lastFrameAt) {
      const delta = now - lastFrameAt;
      // A tab that was hidden produces one enormous gap that is not a stall.
      if (delta < 2000) frames.push(delta);
      if (context) context.points = points;
    }
    lastFrameAt = now;
  },

  start(matchCode) {
    context = { matchCode, points: 0 };
    lastFrameAt = 0;
    clearInterval(timer);
    timer = setInterval(flush, FLUSH_MS);
  },

  stop() {
    clearInterval(timer);
    timer = null;
    context = null;
    frames.length = 0;
    lastFrameAt = 0;
  },
};
