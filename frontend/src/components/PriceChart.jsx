import { useEffect, useRef, useState } from "react";
import { price as fmtPrice } from "../lib/format";

const PAD_RIGHT = 54;
const PAD_Y = 14;

/**
 * Beyond 2x the line stops looking any sharper, but the cost keeps climbing: a 3x phone
 * would back a 400x200 canvas with 1200x600 pixels and re-path the whole series into it
 * on every frame.
 */
const MAX_DPR = 2;

/** Falls back to the server's tick spacing if a round somehow starts with one point. */
const DEFAULT_GAP_MS = 100;

/**
 * Read once, on the first draw. These are `:root` custom properties that never change at
 * run time, and `getComputedStyle` forces a style recalculation — reading them per draw
 * meant a flush every frame for values that are constant.
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
 * Collapses the series to at most two points per pixel column.
 *
 * A 180-second round produces 1800 points for a chart a few hundred pixels wide, so most
 * of them land on top of each other. Keeping the lowest and highest of each column rather
 * than sampling preserves the envelope — including the single spike a rug pull hangs on,
 * which plain stride sampling would eventually drop.
 */
function decimate(series, plotW, span) {
  if (series.length <= plotW) return series;

  const out = [];
  let column = -1;
  let lo = null;
  let hi = null;

  const flush = () => {
    if (!lo) return;
    const first = lo.t <= hi.t ? lo : hi;
    const second = first === lo ? hi : lo;
    out.push(first);
    if (second !== first) out.push(second);
  };

  for (const point of series) {
    const at = Math.floor((point.t / span) * plotW);
    if (at !== column) {
      flush();
      column = at;
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
 * Draws one frame. Returns whether the chart has caught up with the latest price and has
 * nothing left to animate, which is the loop's signal to stop until the next point lands.
 */
function draw(canvas, size, state) {
  const { series, position, startPrice, roundMillis } = state;
  if (!canvas || size.w === 0 || size.h === 0) return true;

  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const backingW = Math.round(size.w * dpr);
  const backingH = Math.round(size.h * dpr);

  // Assigning width or height reallocates the backing bitmap and resets every context
  // property, so it must not happen on a frame where the size did not actually change.
  if (canvas.width !== backingW || canvas.height !== backingH) {
    canvas.width = backingW;
    canvas.height = backingH;
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size.w, size.h);

  const plotW = size.w - PAD_RIGHT;
  const plotH = size.h - PAD_Y * 2;
  if (plotW <= 0 || plotH <= 0) return true;

  const paint = colors();

  // The liquidation price is deliberately kept out of the scale. At low leverage it can
  // sit 30% away, and including it would squash the price action into a sliver. It gets
  // pinned to the edge instead when it's far off, and drawn in place once it's close —
  // which is exactly when it starts to matter.
  //
  // Walked rather than spread through Math.min: the spread builds an argument list as
  // long as the series, which a long round pushes past a thousand.
  let min = Infinity;
  let max = -Infinity;
  for (const point of series) {
    if (point.p < min) min = point.p;
    if (point.p > max) max = point.p;
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

  // The window grows with the round rather than reserving the full width for time that
  // has not happened yet. Reserving it left the line as a squiggle in the corner for most
  // of a round; the clock in the strip is what tells you how long is left. The floor stops
  // the first few ticks from being stretched across the whole panel.
  const elapsed = series.at(-1)?.t ?? 0;
  const span = Math.max(elapsed, roundMillis * 0.12);

  const x = (t) => (t / span) * plotW;
  const y = (p) => PAD_Y + plotH - ((p - min) / (max - min)) * plotH;

  // Prices land ten times a second while the screen refreshes sixty, so the head is eased
  // from the previous point to the newest one across the gap between them. It costs one
  // tick of lag and buys motion that does not visibly step.
  const last = series.at(-1);
  const prev = series.length > 1 ? series[series.length - 2] : null;
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

  const lastPrice = head?.p ?? startPrice;
  const lineColor = lastPrice >= startPrice ? paint.pump : paint.dump;

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

  // Suppressed when a position's entry sits on top of it, otherwise the two labels
  // collide and both become unreadable.
  const entryNearOpen = position && Math.abs(y(position.entryPrice) - y(startPrice)) < 13;
  if (!entryNearOpen) {
    hLine(startPrice, paint.haze, [2, 4], "open");
  }

  if (series.length > 1) {
    // Cached: the thinned path only changes when a point lands or the chart is resized,
    // never between frames of the same tick.
    if (state.thinnedFor !== series || state.thinnedW !== plotW) {
      state.thinned = decimate(series.slice(0, -1), plotW, span);
      state.thinnedFor = series;
      state.thinnedW = plotW;
    }
    const body = state.thinned;

    const trace = (target, moveToFloor) => {
      if (moveToFloor) target.moveTo(x(body[0].t), PAD_Y + plotH);
      else target.moveTo(x(body[0].t), y(body[0].p));
      for (const point of body) target.lineTo(x(point.t), y(point.p));
      target.lineTo(x(head.t), y(head.p));
    };

    const area = new Path2D();
    trace(area, true);
    area.lineTo(x(head.t), PAD_Y + plotH);
    area.closePath();

    const gradient = ctx.createLinearGradient(0, PAD_Y, 0, PAD_Y + plotH);
    gradient.addColorStop(0, `${lineColor}33`);
    gradient.addColorStop(1, `${lineColor}00`);
    ctx.fillStyle = gradient;
    ctx.fill(area);

    ctx.beginPath();
    trace(ctx, false);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke();

    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(x(head.t), y(head.p), 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (position) {
    hLine(position.entryPrice, paint.paper, [5, 3], "entry");
    hLine(position.liquidationPrice, paint.dump, [7, 3], "LIQ", true);
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

  // The draw loop reads the world from here, so a price landing ten times a second does
  // not tear the loop down and build it again.
  const liveRef = useRef({ series, roundMillis, position, startPrice, arrivedAt: 0 });
  const sizeRef = useRef(size);
  const frameRef = useRef(0);
  const runningRef = useRef(false);

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

    // A new point restarts the easing, and with it the loop — which parks itself as soon
    // as the head has caught up, so a paused or finished round costs nothing.
    if (live.series !== series) {
      live.series = series;
      live.arrivedAt = performance.now();
    }

    if (runningRef.current) return undefined;
    runningRef.current = true;

    const loop = () => {
      if (draw(canvasRef.current, sizeRef.current, liveRef.current)) {
        runningRef.current = false;
        return;
      }
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);

    return undefined;
  }, [series, size, position, startPrice, roundMillis]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
      runningRef.current = false;
    },
    [],
  );

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
        role="img"
        aria-label={`Price chart. Now ${fmtPrice(series.at(-1)?.p ?? startPrice)}, opened at ${fmtPrice(startPrice)}.`}
      />
    </div>
  );
}
