import { useEffect, useRef, useState } from "react";
import { price as fmtPrice } from "../lib/format";

const PAD_RIGHT = 54;
const PAD_Y = 14;

/**
 * Beyond 2x the line stops looking any sharper, but the cost keeps climbing: a 3x phone
 * would back a 400x200 canvas with 1200x600 pixels and re-path the whole series into it
 * ten times a second.
 */
const MAX_DPR = 2;

/**
 * Read once, on the first draw. These are `:root` custom properties that never change at
 * run time, and `getComputedStyle` forces a style recalculation — reading them per draw
 * meant several flushes a second for values that are constant.
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
 * A round is one bounded window, so there is nothing to pan or zoom. Drawing it directly
 * buys the two things a charting library would not give: the liquidation line closing in on
 * the price, and a look that matches the rest of the game.
 */
export default function PriceChart({ series, roundMillis, position, startPrice }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return undefined;

    // Prices arrive on network timing while the display refreshes on its own clock, so
    // drawing straight from the message lands frames at uneven offsets and reads as
    // judder. Deferring to the next frame also collapses two updates that land inside one
    // frame into a single draw.
    const frame = requestAnimationFrame(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const backingW = Math.round(size.w * dpr);
      const backingH = Math.round(size.h * dpr);

      // Assigning width or height reallocates the backing bitmap and resets every context
      // property, so it must not happen on a draw where the size did not actually change.
      if (canvas.width !== backingW || canvas.height !== backingH) {
        canvas.width = backingW;
        canvas.height = backingH;
      }

      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.h);

      const plotW = size.w - PAD_RIGHT;
      const plotH = size.h - PAD_Y * 2;
      if (plotW <= 0 || plotH <= 0) return;

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
      if (min === Infinity) return;

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

      const last = series.at(-1)?.p ?? startPrice;
      const up = last >= startPrice;
      const lineColor = up ? paint.pump : paint.dump;

      const hLine = (value, color, dash, label, clampToEdge = false) => {
        if (value == null) return;
        const offChart = value < min || value > max;
        if (offChart && !clampToEdge) return;

        const py = offChart
          ? value < min
            ? PAD_Y + plotH - 1
            : PAD_Y + 1
          : y(value);

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
      const entryNearOpen =
        position && Math.abs(y(position.entryPrice) - y(startPrice)) < 13;
      if (!entryNearOpen) {
        hLine(startPrice, paint.haze, [2, 4], "open");
      }

      if (series.length > 1) {
        ctx.beginPath();
        ctx.moveTo(x(series[0].t), y(series[0].p));
        series.forEach((d) => ctx.lineTo(x(d.t), y(d.p)));

        const area = new Path2D();
        area.moveTo(x(series[0].t), PAD_Y + plotH);
        series.forEach((d) => area.lineTo(x(d.t), y(d.p)));
        area.lineTo(x(series.at(-1).t), PAD_Y + plotH);
        area.closePath();

        const gradient = ctx.createLinearGradient(0, PAD_Y, 0, PAD_Y + plotH);
        gradient.addColorStop(0, `${lineColor}33`);
        gradient.addColorStop(1, `${lineColor}00`);
        ctx.fillStyle = gradient;
        ctx.fill(area);

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.stroke();

        const head = series.at(-1);
        ctx.fillStyle = lineColor;
        ctx.beginPath();
        ctx.arc(x(head.t), y(head.p), 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (position) {
        hLine(position.entryPrice, paint.paper, [5, 3], "entry");
        hLine(position.liquidationPrice, paint.dump, [7, 3], "LIQ", true);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [series, size, position, startPrice, roundMillis]);

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
