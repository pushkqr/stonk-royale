import { describe, expect, it } from "vitest";
import {
  RENDER_DELAY_MS,
  advance,
  createClock,
  sampleAt,
  strideFor,
} from "../lib/chartClock";

/**
 * One server tick, in milliseconds — MatchConfig.STEP_MILLIS, which is integer 1000/30.
 *
 * Not a detail of the fixtures. RENDER_DELAY_MS is chosen relative to this interval, and a
 * test that feeds samples at some other spacing is exercising a configuration that does not
 * exist: give a 50ms delay 100ms samples and the playhead pins to the newest sample and
 * stalls, which fails the smoothness assertions for a reason the code is not responsible for.
 * If the tick rate moves, this moves with it.
 */
const SAMPLE_MS = 33;

describe("chartClock", () => {
  it("keeps the head at a near-constant speed on any refresh rate", () => {
    const refreshRates = [60, 120, 165];

    for (const hz of refreshRates) {
      const frameMs = 1000 / hz;
      const clock = createClock();

      // Build points where p === t, one sample every SAMPLE_MS
      const totalTimeMs = 10000;
      const points = [];
      for (let t = 0; t <= totalTimeMs; t += SAMPLE_MS) {
        points.push({ t, p: t });
      }

      // Simulate playback frame-by-frame
      let lastP = null;
      const velocities = [];

      for (let simTime = 0; simTime <= totalTimeMs; simTime += frameMs) {
        // How many samples have arrived by simTime
        const availableCount = Math.min(points.length, Math.floor(simTime / SAMPLE_MS) + 1);
        const newestT = points[availableCount - 1].t;

        const playhead = advance(clock, newestT, frameMs);
        const head = sampleAt(points, availableCount, playhead);

        // Discard initial warmup period until clock reaches target delay and stabilizes
        if (playhead > 500 && simTime < totalTimeMs - 500) {
          if (lastP !== null) {
            const v = (head.p - lastP) / frameMs;
            velocities.push(v);
          }
        }
        lastP = head.p;
      }

      const minV = Math.min(...velocities);
      const maxV = Math.max(...velocities);
      const ratio = maxV / minV;

      expect(ratio).toBeLessThan(1.2);
    }
  });

  it("ensures playhead frame-to-frame delta never exceeds the rate clamp bound", () => {
    const clock = createClock();
    const frameMs = 1000 / 60;
    const maxAllowedDelta = frameMs * 1.05 + 1e-9;

    let newestT = 0;
    let lastPlayhead = null;

    for (let t = 0; t <= 5000; t += frameMs) {
      if (t % SAMPLE_MS < frameMs) {
        newestT += SAMPLE_MS;
      }
      const playhead = advance(clock, newestT, frameMs);
      if (lastPlayhead !== null && playhead > 0) {
        const delta = playhead - lastPlayhead;
        expect(delta).toBeLessThanOrEqual(maxAllowedDelta);
      }
      lastPlayhead = playhead;
    }
  });

  it("never lets the playhead pass the newest sample even during a stall", () => {
    const clock = createClock();
    const frameMs = 16.67;
    const newestT = 1000;

    // Advance clock past newestT
    for (let i = 0; i < 100; i++) {
      const playhead = advance(clock, newestT, frameMs);
      expect(playhead).toBeLessThanOrEqual(newestT);
    }
  });

  it("catches up after a stream stall rather than staying permanently behind", () => {
    const clock = createClock();
    const frameMs = 16.67;

    // Normal stream up to 2000ms
    for (let simTime = 0; simTime <= 2000; simTime += frameMs) {
      const newestT = Math.floor(simTime / SAMPLE_MS) * SAMPLE_MS;
      advance(clock, newestT, frameMs);
    }

    // Stall for 1.5 seconds (newestT remains 2000ms)
    for (let i = 0; i < 90; i++) {
      advance(clock, 2000, frameMs);
    }
    expect(clock.playhead).toBe(2000);

    // Stream resumes up to 10000ms (8 seconds of playback)
    for (let simTime = 2000; simTime <= 10000; simTime += frameMs) {
      const newestT = Math.floor(simTime / SAMPLE_MS) * SAMPLE_MS;
      advance(clock, newestT, frameMs);
    }

    // Playhead should have caught up and now be tracking ~RENDER_DELAY_MS behind newestT
    const finalNewestT = 10000;
    const lag = finalNewestT - clock.playhead;
    expect(lag).toBeGreaterThanOrEqual(RENDER_DELAY_MS);
    expect(lag).toBeLessThanOrEqual(RENDER_DELAY_MS + SAMPLE_MS);
  });

  it("strideFor only ever removes vertices across doubling boundaries", () => {
    const counts = [400, 401, 800, 801, 1600, 1601];

    for (let idx = 0; idx < counts.length - 1; idx++) {
      const c1 = counts[idx];
      const c2 = counts[idx + 1];
      const s1 = strideFor(c1);
      const s2 = strideFor(c2);

      const indices1 = new Set();
      for (let i = 0; i < c1; i += s1) indices1.add(i);

      const indices2 = [];
      for (let i = 0; i < c2; i += s2) indices2.push(i);

      // Every vertex index kept at larger count (within range c1) must be in the smaller count's set
      for (const i of indices2) {
        if (i < c1) {
          expect(indices1.has(i)).toBe(true);
        }
      }
    }
  });

  it("sampleAt returns an index whose sample is at or before the playhead, never after", () => {
    const points = [
      { t: 0, p: 100 },
      { t: 100, p: 105 },
      { t: 200, p: 95 },
      { t: 300, p: 110 },
      { t: 400, p: 108 },
    ];

    for (let playhead = -50; playhead <= 500; playhead += 12.5) {
      const sample = sampleAt(points, points.length, playhead);
      if (playhead >= points[0].t) {
        const sampleT = points[sample.index].t;
        expect(sampleT).toBeLessThanOrEqual(playhead);
      } else {
        expect(sample.index).toBe(0);
      }
    }
  });

  /**
   * The lag is the whole trade this module makes: the playhead sits behind the newest sample
   * so it always has two real samples to interpolate between, which is what stops the line
   * snapping. It is also the distance between the head a player aims at and the price their
   * order actually fills at, so it is felt directly and not only seen.
   *
   * Load-bearing in both directions, which is why it is pinned. Grow it and entries land
   * further from where they were aimed; shrink it below one sample interval and there is
   * nothing ahead to interpolate toward, so the head stalls between arrivals instead of
   * moving — the exact stutter this module was written to remove.
   */
  it("settles a steady RENDER_DELAY_MS behind the newest sample", () => {
    const frameMs = 1000 / 60;
    const clock = createClock();
    const points = [];
    for (let t = 0; t <= 10000; t += SAMPLE_MS) {
      points.push({ t, p: t });
    }

    const lags = [];
    for (let simTime = 0; simTime <= 10000; simTime += frameMs) {
      const availableCount = Math.min(points.length, Math.floor(simTime / SAMPLE_MS) + 1);
      const newestT = points[availableCount - 1].t;
      const playhead = advance(clock, newestT, frameMs);

      // Skip the warm-up, and the tail where the stream stops and the playhead catches up.
      if (simTime > 2000 && simTime < 9000) {
        lags.push(newestT - playhead);
      }
    }

    const mean = lags.reduce((a, b) => a + b, 0) / lags.length;

    // One sample interval of slack either way: the playhead runs continuously while samples
    // land in SAMPLE_MS steps, so the instantaneous gap saws between roughly the delay and
    // the delay plus an interval. It is the centre of that saw this pins.
    expect(mean).toBeGreaterThan(RENDER_DELAY_MS - SAMPLE_MS);
    expect(mean).toBeLessThan(RENDER_DELAY_MS + SAMPLE_MS);
  });
});
