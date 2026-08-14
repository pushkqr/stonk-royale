/**
 * Whether this browser has read the rules.
 *
 * localStorage rather than the sessionStorage seats use: the whole point is that someone
 * coming back for a second match is not made to sit through it again.
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
