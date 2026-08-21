import { memo, useCallback, useEffect, useRef, useState } from "react";
import { usePrice } from "../state/MatchProvider";
import { telemetry } from "../lib/telemetry";
import { unrealisedPnl } from "../lib/pnl";
import { signedMoney } from "../lib/format";
import { advance, createClock, sampleAt, strideFor } from "../lib/chartClock";

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
 * Draws one frame with continuous wall-clock playhead interpolation and direct canvas paths.
 * Returns true when settled and parked.
 */
function draw(canvas, size, state) {
  const { series, position, startPrice, roundMillis } = state;
  /**
   * How far this match sits above the standard settings, as 0 to 1. Volatility widens the
   * base path and market impact rides on top of it, so the two compound — and near the top
   * of both ranges every hundred-millisecond kick lands as its own visible jerk. Nothing
   * here touches the simulation: it only stops the display from reporting each kick as a
   * separate event. At the standard settings this is exactly 0 and the chart is unchanged.
   */
  const chaos = Math.min(
    1,
    Math.max(
      0,
      Math.max(((state.volatility ?? 1) - 1) / 0.8, ((state.impactMultiplier ?? 1) - 1) / 4),
    ),
  );
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

  const pad = (max - min || max * 0.02) * (0.12 + 0.08 * chaos);
  min -= pad;
  max += pad;

  const now = performance.now();
  const frameMs = state.lastFrameTime ? now - state.lastFrameTime : 16.67;
  state.lastFrameTime = now;

  const newestT = points[count - 1]?.t ?? 0;
  const playhead = advance(state.clock, newestT, frameMs);
  const head = sampleAt(points, count, playhead);

  const span = Math.max(playhead, roundMillis * 0.12);

  const x = (t) => (t / span) * plotW;
  const y = (p) => PAD_Y + plotH - ((p - min) / (max - min)) * plotH;

  const isSettled = playhead >= newestT;

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
    // 1. Fill gradient under the curve (cached)
    if (state.gradientColor !== lineColor || state.gradientH !== plotH) {
      const gradient = ctx.createLinearGradient(0, PAD_Y, 0, PAD_Y + plotH);
      gradient.addColorStop(0, `${lineColor}33`);
      gradient.addColorStop(1, `${lineColor}00`);
      state.gradient = gradient;
      state.gradientColor = lineColor;
      state.gradientH = plotH;
    }

    const step = strideFor(count);

    ctx.beginPath();
    ctx.moveTo(x(points[0].t), PAD_Y + plotH);
    for (let i = 0; i <= head.index; i += step) {
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
    for (let i = step; i <= head.index; i += step) {
      ctx.lineTo(x(points[i].t), y(points[i].p));
    }
    ctx.lineTo(x(head.t), y(head.p));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    // 3. Head Halo & Dot (0 allocations, pure GPU blend)
    const headX = x(head.t);
    const headY = y(head.p);

    // Layered neon halo
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(headX, headY, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(headX, headY, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Solid inner core
    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(headX, headY, 4, 0, Math.PI * 2);
    ctx.fill();

    // White center specular point
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(headX, headY, 1.8, 0, Math.PI * 2);
    ctx.fill();

  }

  if (position) {
    hLine(position.entryPrice, paint.paper, [5, 3], "entry");
    hLine(position.liquidationPrice, paint.dump, [7, 3], "WIPED", true);

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

  // 4. Liquidation Battle-Scar Markers along the price curve
  const liquidations = state.liquidations;
  if (liquidations && liquidations.length > 0) {
    ctx.save();
    for (let i = 0; i < liquidations.length; i += 1) {
      const m = liquidations[i];
      if (m.t > playhead) continue;
      const mx = x(m.t);
      const my = y(m.p);

      if (mx >= 0 && mx <= plotW) {
        // Vertical dashed drop line
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = m.isMine ? "rgba(255, 59, 84, 0.7)" : "rgba(244, 63, 94, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mx, PAD_Y);
        ctx.lineTo(mx, PAD_Y + plotH);
        ctx.stroke();

        // Skull & dot marker on the curve
        ctx.setLineDash([]);
        ctx.fillStyle = m.isMine ? "#ff3b54" : "#f43f5e";
        ctx.beginPath();
        ctx.arc(mx, my, m.isMine ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Monospace text label
        ctx.font = "700 8.5px 'Space Mono', monospace";
        ctx.fillStyle = m.isMine ? "#ffffff" : "rgba(255, 244, 224, 0.75)";
        ctx.textBaseline = "bottom";
        const label = `💀 ${m.nickname || "REKT"}`;
        ctx.fillText(label, Math.max(4, Math.min(plotW - 55, mx - 14)), Math.max(PAD_Y + 12, my - 6));
      }
    }
    ctx.restore();
  }

  return isSettled;
}

const EMPTY_SERIES = { points: [], count: 0 };

function PriceChart({
  series: propSeries,
  roundMillis,
  position,
  startPrice,
  liquidations = [],
  floaters = [],
  volatility = 1,
  impactMultiplier = 1,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const priceCtx = usePrice();
  const series = propSeries || priceCtx?.series || EMPTY_SERIES;

  const liveRef = useRef({
    series,
    roundMillis,
    position,
    startPrice,
    liquidations,
    volatility,
    impactMultiplier,
    clock: createClock(),
    lastFrameTime: 0,
  });
  const sizeRef = useRef(size);
  const frameRef = useRef(0);
  const runningRef = useRef(false);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    // Zeroed on every start, not just the first. The loop parks when it settles and is woken
    // again by the next sample, and a stale timestamp across that gap makes the first frame
    // back believe a tenth of a second passed — which used to land as a jump exactly when the
    // chart was supposed to be picking up smoothly.
    liveRef.current.lastFrameTime = 0;
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
    live.liquidations = liquidations;
    live.volatility = volatility;
    live.impactMultiplier = impactMultiplier;
    sizeRef.current = size;

    start();
    return undefined;
  }, [series, size, position, startPrice, roundMillis, liquidations, volatility, impactMultiplier, start]);

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
      {floaters && floaters.length > 0 && (
        <div className="pnl-floaters-container" aria-live="polite">
          {floaters.map((f) => (
            <div key={f.id} className={`pnl-floater tone-${f.tone}`}>
              <span>{f.text}</span>
              {f.subtext && <span className="pnl-floater-sub">{f.subtext}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(PriceChart);
