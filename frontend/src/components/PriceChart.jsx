import { useCallback, useEffect, useRef, useState } from "react";
import { usePrice } from "../state/MatchProvider";
import { telemetry } from "../lib/telemetry";
import { unrealisedPnl } from "../lib/pnl";
import { signedMoney } from "../lib/format";

const PAD_RIGHT = 54;
const PAD_Y = 14;
const MAX_DPR = 2;

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
 * Draws one frame with continuous critically-damped exponential smoothing and direct canvas paths.
 * Returns true when settled and parked.
 */
function draw(canvas, size, state) {
  const { series, position, startPrice, roundMillis } = state;
  const points = series?.points;
  const count = series?.count ?? 0;
  if (!canvas || size.w === 0 || size.h === 0 || count === 0 || !points) return true;

  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const backingW = Math.round(size.w * dpr);
  const backingH = Math.round(size.h * dpr);

  if (canvas.width !== backingW || canvas.height !== backingH) {
    canvas.width = backingW;
    canvas.height = backingH;
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

  // Find min/max range
  let min = Infinity;
  let max = -Infinity;
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
  if (min === Infinity || max === -Infinity) return true;

  const pad = (max - min || max * 0.02) * 0.12;
  min -= pad;
  max += pad;

  const elapsed = points[count - 1]?.t ?? 0;
  const span = Math.max(elapsed, roundMillis * 0.12);

  const x = (t) => (t / span) * plotW;
  const y = (p) => PAD_Y + plotH - ((p - min) / (max - min)) * plotH;

  // Continuous framerate-independent exponential smoothing (lambda ~ 18 gives snappy responsiveness)
  const now = performance.now();
  const dt = Math.min(0.1, Math.max(0.001, (now - (state.lastFrameTime || now)) / 1000));
  state.lastFrameTime = now;

  const target = points[count - 1];
  const targetP = target.p;
  const targetT = target.t;

  if (state.smoothP == null) {
    state.smoothP = targetP;
    state.smoothT = targetT;
  } else {
    const lambda = 18;
    const factor = 1 - Math.exp(-lambda * dt);
    state.smoothP += (targetP - state.smoothP) * factor;
    state.smoothT += (targetT - state.smoothT) * factor;
  }

  const head = {
    t: state.smoothT,
    p: state.smoothP,
  };

  const isSettled =
    Math.abs(state.smoothP - targetP) < 0.001 && Math.abs(state.smoothT - targetT) < 0.5;

  const lineColor = (head.p ?? startPrice) >= startPrice ? paint.pump : paint.dump;

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

  const entryNearOpen = position && Math.abs(y(position.entryPrice) - y(startPrice)) < 13;
  if (!entryNearOpen) {
    hLine(startPrice, paint.haze, [2, 4], "open");
  }

  if (count > 0) {
    // 1. Fill gradient under the curve
    if (state.gradientColor !== lineColor || state.gradientH !== plotH) {
      const gradient = ctx.createLinearGradient(0, PAD_Y, 0, PAD_Y + plotH);
      gradient.addColorStop(0, `${lineColor}33`);
      gradient.addColorStop(1, `${lineColor}00`);
      state.gradient = gradient;
      state.gradientColor = lineColor;
      state.gradientH = plotH;
    }

    ctx.beginPath();
    ctx.moveTo(x(points[0].t), PAD_Y + plotH);
    for (let i = 0; i < count - 1; i += 1) {
      ctx.lineTo(x(points[i].t), y(points[i].p));
    }
    ctx.lineTo(x(head.t), y(head.p));
    ctx.lineTo(x(head.t), PAD_Y + plotH);
    ctx.closePath();
    ctx.fillStyle = state.gradient;
    ctx.fill();

    // 2. Stroke main price line
    ctx.beginPath();
    ctx.moveTo(x(points[0].t), y(points[0].p));
    for (let i = 1; i < count - 1; i += 1) {
      ctx.lineTo(x(points[i].t), y(points[i].p));
    }
    ctx.lineTo(x(head.t), y(head.p));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // 3. Head Halo & Dot
    const headX = x(head.t);
    const headY = y(head.p);

    // Radial breathing neon pulse
    const pulse = 1 + 0.25 * Math.sin(now * 0.008);
    const haloRadius = 12 * pulse;
    const radial = ctx.createRadialGradient(headX, headY, 2, headX, headY, haloRadius);
    radial.addColorStop(0, `${lineColor}88`);
    radial.addColorStop(0.6, `${lineColor}33`);
    radial.addColorStop(1, `${lineColor}00`);

    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(headX, headY, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    // Solid inner core
    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(headX, headY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // White center specular point
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(headX, headY, 1.8, 0, Math.PI * 2);
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

  return isSettled;
}

const EMPTY_SERIES = { points: [], count: 0 };

export default function PriceChart({ series: propSeries, roundMillis, position, startPrice }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const priceCtx = usePrice();
  const series = propSeries || priceCtx?.series || EMPTY_SERIES;

  const liveRef = useRef({ series, roundMillis, position, startPrice, smoothP: null, smoothT: null, lastFrameTime: 0 });
  const sizeRef = useRef(size);
  const frameRef = useRef(0);
  const runningRef = useRef(false);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    const loop = () => {
      telemetry.frame(liveRef.current.series?.count ?? 0);
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
    live.series = series;
    sizeRef.current = size;

    start();
    return undefined;
  }, [series, size, position, startPrice, roundMillis, start]);

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
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
        role="img"
        aria-label="Price chart for the round in progress"
      />
    </div>
  );
}
