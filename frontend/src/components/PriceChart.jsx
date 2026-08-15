import { useCallback, useEffect, useRef, useState } from "react";
import { telemetry } from "../lib/telemetry";
import { unrealisedPnl } from "../lib/pnl";
import { signedMoney } from "../lib/format";

const PAD_RIGHT = 54;
const PAD_Y = 14;

/**
 * Beyond 2x the line stops looking any sharper, but the cost keeps climbing: a 3x display
 * would back the canvas with nine times the pixels and rasterise the whole stroke into
 * them on every frame.
 */
const MAX_DPR = 2;

/**
 * An absolute ceiling on plotted points, deliberately not tied to the canvas width.
 *
 * Tying it to width meant a wide desktop chart (~1250px) never thinned at all, because a
 * 90-second round produces only ~900 points — so the machines with the most pixels to fill
 * were also the ones drawing every last point. A line chart gains nothing visible from
 * more than one point per few pixels.
 */
const MAX_POINTS = 350;

/**
 * Prices arrive ten times a second, so drawing faster than this only re-interpolates one
 * short head segment. On a 120Hz or 180Hz panel the uncapped loop did two to three times the
 * work for no visible gain, and those were the machines reporting the worst stalls.
 */
const MIN_FRAME_MS = 15;

/** Falls back to the server's tick spacing if a round somehow starts with one point. */
const DEFAULT_GAP_MS = 100;

/**
 * Read once, on the first draw. These are `:root` custom properties that never change at
 * run time, and `getComputedStyle` forces a style recalculation.
 */
let palette;
function colors() {
  if (!palette) {
    const root = getComputedStyle(document.documentElement);
    const read = (name) => root.getPropertyValue(name).trim();
    palette = {
      pump: read("--pump"),
      dump: read("--dump"),
      haze: read("--haze"),
      paper: read("--paper"),
    };
  }
  return palette;
}

/**
 * Thins the first {@code count} points down to at most two per bucket.
 *
 * Keeping each bucket's lowest and highest rather than sampling preserves the envelope,
 * including the single spike a rug pull hangs on, which stride sampling would eventually
 * drop.
 */
function decimate(series, count, span) {
  if (count <= MAX_POINTS) return series.slice(0, count);

  const out = [];
  let bucket = -1;
  let lo = null;
  let hi = null;

  const flush = () => {
    if (!lo) return;
    const first = lo.t <= hi.t ? lo : hi;
    const second = first === lo ? hi : lo;
    out.push(first);
    if (second !== first) out.push(second);
  };

  for (let i = 0; i < count; i += 1) {
    const point = series[i];
    const at = Math.floor((point.t / span) * MAX_POINTS);
    if (at !== bucket) {
      flush();
      bucket = at;
      lo = point;
      hi = point;
    } else {
      if (point.p < lo.p) lo = point;
      if (point.p > hi.p) hi = point;
    }
  }
  flush();
  return out;
}

/**
 * Draws one frame. Returns whether the head has caught up with the latest price and there
 * is nothing left to animate, which is the loop's signal to park until the next point.
 */
function draw(canvas, size, state) {
  const { series, position, startPrice, roundMillis } = state;
  const points = series.points;
  const count = series.count;
  if (!canvas || size.w === 0 || size.h === 0 || count === 0) return true;

  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const backingW = Math.round(size.w * dpr);
  const backingH = Math.round(size.h * dpr);

  // Assigning width or height reallocates the backing bitmap and resets every context
  // property, so it must not happen on a frame where the size did not change.
  if (canvas.width !== backingW || canvas.height !== backingH) {
    canvas.width = backingW;
    canvas.height = backingH;
    // Reallocating the bitmap resets the context, and a gradient made by the old one is not
    // valid against the new.
    state.gradient = null;
    state.gradientColor = null;
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size.w, size.h);

  const plotW = size.w - PAD_RIGHT;
  const plotH = size.h - PAD_Y * 2;
  if (plotW <= 0 || plotH <= 0) return true;

  const paint = colors();

  // The liquidation price is deliberately kept out of the scale. At low leverage it can sit
  // 30% away, and including it would squash the price action into a sliver. It gets pinned
  // to the edge instead when far off, and drawn in place once it is close — which is
  // exactly when it starts to matter.
  let min = Infinity;
  let max = -Infinity;
  // Bounded by count, not by the array's length: count is the authority on how much of the
  // buffer is live, and reading it keeps that true however the points came to be there.
  for (let i = 0; i < count; i += 1) {
    const p = points[i].p;
    if (p < min) min = p;
    if (p > max) max = p;
  }
  for (const anchor of [startPrice, position?.entryPrice]) {
    if (!anchor) continue;
    if (anchor < min) min = anchor;
    if (anchor > max) max = anchor;
  }
  if (min === Infinity) return true;

  const pad = (max - min || max * 0.02) * 0.12;
  min -= pad;
  max += pad;

  // The window grows with the round rather than reserving width for time that has not
  // happened yet. The floor stops the first few ticks being stretched across the panel.
  const elapsed = points[count - 1]?.t ?? 0;
  const span = Math.max(elapsed, roundMillis * 0.12);

  const x = (t) => (t / span) * plotW;
  const y = (p) => PAD_Y + plotH - ((p - min) / (max - min)) * plotH;

  // Prices land ten times a second while the screen refreshes sixty, so the head eases from
  // the previous point to the newest across the gap between them. It costs one tick of lag
  // and buys motion that does not visibly step.
  const last = points[count - 1];
  const prev = count > 1 ? points[count - 2] : null;
  let alpha = 1;
  let head = last;

  if (prev && last) {
    const gap = last.t - prev.t || DEFAULT_GAP_MS;
    alpha = Math.min(1, Math.max(0, (performance.now() - state.arrivedAt) / gap));
    head = {
      t: prev.t + (last.t - prev.t) * alpha,
      p: prev.p + (last.p - prev.p) * alpha,
    };
  }

  const lineColor = (head?.p ?? startPrice) >= startPrice ? paint.pump : paint.dump;

  const hLine = (value, color, dash, label, clampToEdge = false) => {
    if (value == null) return;
    const offChart = value < min || value > max;
    if (offChart && !clampToEdge) return;

    const py = offChart ? (value < min ? PAD_Y + plotH - 1 : PAD_Y + 1) : y(value);

    ctx.save();
    ctx.globalAlpha = offChart ? 0.45 : 1;
    ctx.setLineDash(dash);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(plotW, py);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = color;
    ctx.globalAlpha = offChart ? 0.55 : 1;
    ctx.font = "700 10px 'Space Mono', monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(label, plotW + 6, py);
    ctx.globalAlpha = 1;
  };

  // Suppressed when a position's entry sits on top of it, otherwise the two labels collide
  // and both become unreadable.
  const entryNearOpen = position && Math.abs(y(position.entryPrice) - y(startPrice)) < 13;
  if (!entryNearOpen) {
    hLine(startPrice, paint.haze, [2, 4], "open");
  }

  if (count > 1) {
    /*
      Everything behind the head is fixed for the whole tick, so its geometry is built once
      per tick and replayed for the six or so frames that follow. Rebuilding a Path2D of
      several hundred segments on every frame was the actual fault here: it churned enough
      memory to earn a garbage-collection pause, which read on screen as the chart freezing,
      stuttering, then carrying on.

      The scale moves whenever the price sets a new extreme, so the cache is keyed on it
      rather than on the series alone.
    */
    if (
      state.keyCount !== count ||
      state.keyMin !== min ||
      state.keyMax !== max ||
      state.keySpan !== span ||
      state.keyW !== plotW ||
      state.keyH !== plotH
    ) {
      const body = decimate(points, count - 1, span);
      const line = new Path2D();
      const area = new Path2D();

      line.moveTo(x(body[0].t), y(body[0].p));
      area.moveTo(x(body[0].t), PAD_Y + plotH);
      for (const point of body) {
        const px = x(point.t);
        const py = y(point.p);
        line.lineTo(px, py);
        area.lineTo(px, py);
      }

      const tail = body[body.length - 1];
      area.lineTo(x(tail.t), PAD_Y + plotH);
      area.closePath();

      state.line = line;
      state.area = area;
      state.tailX = x(tail.t);
      state.tailY = y(tail.p);
      state.keyCount = count;
      state.keyMin = min;
      state.keyMax = max;
      state.keySpan = span;
      state.keyW = plotW;
      state.keyH = plotH;
    }

    // Cached on the same terms as the paths above. It was being rebuilt on every frame —
    // sixty to a hundred and eighty times a second — for something that only changes when
    // the line flips colour or the panel is resized.
    if (state.gradientColor !== lineColor || state.gradientH !== plotH) {
      const gradient = ctx.createLinearGradient(0, PAD_Y, 0, PAD_Y + plotH);
      gradient.addColorStop(0, `${lineColor}33`);
      gradient.addColorStop(1, `${lineColor}00`);
      state.gradient = gradient;
      state.gradientColor = lineColor;
      state.gradientH = plotH;
    }
    ctx.fillStyle = state.gradient;
    ctx.fill(state.area);

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke(state.line);

    // The one moving segment, drawn separately so the cached path never has to be rebuilt
    // mid-tick. Round caps make the join invisible.
    const headX = x(head.t);
    const headY = y(head.p);
    ctx.beginPath();
    ctx.moveTo(state.tailX, state.tailY);
    ctx.lineTo(headX, headY);
    ctx.stroke();

    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(headX, headY, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (position) {
    hLine(position.entryPrice, paint.paper, [5, 3], "entry");
    hLine(position.liquidationPrice, paint.dump, [7, 3], "LIQ", true);

    if (head) {
      const livePnlVal = unrealisedPnl(position, head.p);
      const pnlColor = livePnlVal >= 0 ? paint.pump : paint.dump;
      const pnlLabel = signedMoney(livePnlVal);
      const headY = y(head.p);

      ctx.fillStyle = pnlColor;
      ctx.font = "700 9px 'Space Mono', monospace";
      ctx.textBaseline = "top";
      ctx.fillText(pnlLabel, plotW + 6, Math.min(PAD_Y + plotH - 12, headY + 8));
    }
  }

  return alpha >= 1;
}

/**
 * A round is one bounded window, so there is nothing to pan or zoom. Drawing it directly
 * buys the two things a charting library would not give: the liquidation line closing in on
 * the price, and a look that matches the rest of the game.
 */
export default function PriceChart({ series, roundMillis, position, startPrice }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // The draw loop reads the world from here, so a price landing ten times a second does not
  // tear the loop down and build it again.
  const liveRef = useRef({ series, roundMillis, position, startPrice, arrivedAt: 0 });
  const sizeRef = useRef(size);
  const frameRef = useRef(0);
  const runningRef = useRef(false);
  const lastDrawRef = useRef(0);

  // Stable for the component's life: it reads everything it needs from refs at call time,
  // so it never needs rebuilding and never goes stale.
  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    const loop = () => {
      const now = performance.now();
      if (now - lastDrawRef.current < MIN_FRAME_MS) {
        frameRef.current = requestAnimationFrame(loop);
        return;
      }
      lastDrawRef.current = now;

      // Timed here rather than in a separate rAF, so the measurement is of the frames this
      // chart actually drew — the ones a stutter would show up in.
      telemetry.frame(liveRef.current.series.count);
      if (draw(canvasRef.current, sizeRef.current, liveRef.current)) {
        runningRef.current = false;
        return;
      }
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const live = liveRef.current;
    live.roundMillis = roundMillis;
    live.position = position;
    live.startPrice = startPrice;
    sizeRef.current = size;

    // A new point restarts the easing, and with it the loop — which parks itself as soon as
    // the head catches up, so a paused or finished round costs nothing.
    if (live.series !== series) {
      live.series = series;
      live.arrivedAt = performance.now();
    }
    start();
    return undefined;
  }, [series, size, position, startPrice, roundMillis, start]);

  // requestAnimationFrame does not fire while the tab is hidden, so a player who comes back
  // from another window would otherwise be looking at whatever was on screen when they
  // left, until the next price arrives.
  useEffect(() => {
    const wake = () => {
      if (!document.hidden) start();
    };
    document.addEventListener("visibilitychange", wake);
    return () => document.removeEventListener("visibilitychange", wake);
  }, [start]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
      runningRef.current = false;
    },
    [],
  );

  return (
    <div className="chart-wrap" ref={wrapRef}>
      {/* The accessible name is deliberately static. It used to be rebuilt from the latest
          tick on every render — ten times a second for a whole round — and a name that
          changes at that rate is noise rather than information. The live price and the
          round's move sit directly above as ordinary text, which is where a screen reader
          should be reading them from. */}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
        role="img"
        aria-label="Price chart for the round in progress"
      />
    </div>
  );
}
