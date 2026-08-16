import { isMuted } from "./sound";

function canVibrate() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

function vibrate(pattern) {
  if (!canVibrate() || isMuted()) return;
  if (typeof document !== "undefined" && document.hidden) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Graceful no-op on platforms with strict Vibration API permission policies
  }
}

export const haptic = {
  /** Light micro-tap (10ms) — preset selection, tab switching, form buttons */
  tap: () => vibrate(10),

  /** Crisp single pulse (15ms) — Long/Short order submission */
  trade: () => vibrate(15),

  /** Ascending double pulse ([15, 30, 25]ms) — Position closed in green profit */
  success: () => vibrate([15, 30, 25]),

  /** Heavy dual thud ([35, 45]ms) — Position closed in red loss */
  loss: () => vibrate([35, 45]),

  /** Jarring multi-rumble ([60, 40, 90]ms) — Player liquidation strike */
  liquidate: () => vibrate([60, 40, 90]),

  /** Subtle tick (6ms) — Urgent countdown under 5 seconds */
  tick: () => vibrate(6),

  /** Stop all active vibration pulses */
  cancel: () => {
    if (canVibrate()) {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignored
      }
    }
  },
};
