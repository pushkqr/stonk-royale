import { useEffect, useState } from "react";

/** Milliseconds left, measured against the server clock rather than the browser's. */
export function useCountdown(endsAtMillis, serverNow) {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!endsAtMillis) {
      setLeft(0);
      return;
    }
    const update = () => setLeft(Math.max(0, endsAtMillis - serverNow()));
    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [endsAtMillis, serverNow]);

  return left;
}
