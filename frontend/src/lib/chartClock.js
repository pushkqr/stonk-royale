/**
 * A playhead for the price chart.
 *
 * The chart used to animate in sample time: it read the newest sample's timestamp as "now",
 * and since samples land in 100ms steps, everything derived from that timestamp moved in
 * 100ms steps too. The x-axis rescaled up to eleven pixels sideways ten times a second, and
 * the head's speed swung sixfold inside every window. Neither showed up in frame timing,
 * because no frame was ever late — they simply were not evenly spaced in content.
 *
 * So this advances on the wall clock instead, deliberately parked RENDER_DELAY_MS behind the
 * newest sample so there is always a sample ahead to interpolate toward. Drift is absorbed
 * by playing slightly fast or slightly slow rather than by moving the playhead, which is the
 * whole trick: position corrections are applied per frame and so hit harder on a 165Hz panel
 * than a 60Hz one, which is how the previous smoothing ended up frame-rate dependent. A rate
 * correction inside a hard clamp cannot vary on-screen speed by more than the clamp.
 */

/** One sample behind, plus half of one for arrival jitter. Below ~100ms there is nothing to interpolate toward. */
export const RENDER_DELAY_MS = 150;

/** Playback stays within +-5% of real time, which is the bound on how uneven motion can get. */
const RATE_CLAMP = 0.05;

/** How hard drift pulls on the rate. At this gain a 12ms error saturates the clamp. */
const RATE_GAIN = 0.004;

const MAX_VERTICES = 400;

export function createClock() {
  return { playhead: null, rate: 1 };
}

/**
 * Advances the playhead by one frame.
 *
 * @param clock     from createClock, mutated in place
 * @param newestT   timestamp of the most recent sample, in match-elapsed ms
 * @param frameMs   real time since the previous frame
 * @returns the playhead, in match-elapsed ms
 */
export function advance(clock, newestT, frameMs) {
  const dt = Math.min(Math.max(frameMs, 0), 100);
  if (clock.playhead === null) {
    clock.playhead = newestT - RENDER_DELAY_MS;
    clock.rate = 1;
    return clock.playhead;
  }

  const error = (newestT - RENDER_DELAY_MS) - clock.playhead;
  const targetRate = 1 + error * RATE_GAIN;
  clock.rate = Math.min(Math.max(targetRate, 1 - RATE_CLAMP), 1 + RATE_CLAMP);
  clock.playhead += dt * clock.rate;
  if (clock.playhead > newestT) {
    clock.playhead = newestT;
  }
  return clock.playhead;
}

/**
 * The interpolated point at the playhead, plus the index of the last sample at or before it.
 *
 * The index matters as much as the point: the drawn line must stop at the playhead, not run
 * on to samples the playhead has not reached, or the head would trail behind its own curve.
 */
export function sampleAt(points, count, playhead) {
  if (!points || count <= 0) {
    return { t: playhead, p: 0, index: -1 };
  }
  if (count === 1 || playhead <= points[0].t) {
    return { t: playhead, p: points[0].p, index: 0 };
  }
  if (playhead >= points[count - 1].t) {
    return { t: playhead, p: points[count - 1].p, index: count - 1 };
  }

  let low = 0;
  let high = count - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (points[mid].t <= playhead) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  const i = high;
  const p0 = points[i];
  const p1 = points[i + 1];
  const dt = p1.t - p0.t;
  const fraction = dt > 0 ? (playhead - p0.t) / dt : 0;
  const p = p0.p + (p1.p - p0.p) * fraction;

  return { t: playhead, p, index: i };
}

/**
 * Vertex stride, always a power of two.
 *
 * Doubling means the kept indices go 0,2,4… -> 0,4,8…, so a vertex is only ever dropped and
 * never moved. The old ceil(count / 200) went 0,2,4… -> 0,3,6…, re-sampling onto entirely
 * different points and jumping every vertex on screen at once, four times a round.
 */
export function strideFor(count) {
  let stride = 1;
  while (Math.ceil(count / stride) > MAX_VERTICES) {
    stride *= 2;
  }
  return stride;
}
