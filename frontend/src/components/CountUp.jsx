import { useEffect, useRef, useState } from "react";

/**
 * Counts to a number instead of snapping to it.
 *
 * Only for numbers that settle — a final total, a result. Anything that changes several
 * times a second would spend its whole life mid-count and just read as a blur, so the
 * live price deliberately does not use this.
 */
const DURATION_MS = 700;

export default function CountUp({ value, format, className }) {
  const [shown, setShown] = useState(value);
  // Tracks what is actually on screen, so a value that changes mid-count carries on from
  // where the last one got to rather than snapping back to its starting point.
  const shownRef = useRef(value);
  const frameRef = useRef(0);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return undefined;

    // Someone who asked for less motion gets the number, not the journey. Expressed as a
    // zero duration rather than an early setState so the update still lands in a frame
    // callback, which is the only place this component is allowed to set state.
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : DURATION_MS;
    const started = performance.now();

    const tick = (now) => {
      const elapsed = now - started;
      const t = duration <= 0 ? 1 : Math.min(1, elapsed / duration);
      // Fast off the mark, settling into the real figure.
      const next = from + (value - from) * (1 - (1 - t) ** 3);

      shownRef.current = next;
      setShown(next);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);

  return <span className={className}>{format(shown)}</span>;
}
