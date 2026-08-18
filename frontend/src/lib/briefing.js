/**
 * Whether this browser has read the rules.
 *
 * localStorage, and not scoped to a match code: the whole point is that someone coming
 * back for a second game is not made to sit through it again.
 */
const KEY = "stonk:briefed";

export function hasSeenBriefing() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markBriefingSeen() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Storage denied in private browsing. The briefing just shows every time, which is
    // a worse experience but not a broken one.
  }
}
