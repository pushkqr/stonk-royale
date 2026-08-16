import { useEffect, useState } from "react";

/** Milliseconds left, measured against the server clock rather than the browser's. */
export function useCountdown(endsAtMillis, serverNow) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!endsAtMillis || !serverNow) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [endsAtMillis, serverNow]);

  if (!endsAtMillis || !serverNow) return 0;
  return Math.max(0, endsAtMillis - serverNow());
}
