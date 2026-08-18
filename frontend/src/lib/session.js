/**
 * Seats are kept per match code so a refresh mid-game rejoins rather than losing your
 * place — the server keeps the token valid for the life of the match.
 *
 * localStorage rather than sessionStorage: a phone that backgrounds the tab long enough
 * for the browser to reap it used to lose the seat outright while the server was still
 * holding it, and the tab dying is exactly the moment a seamless rejoin matters most.
 * sessionStorage is the one kind of storage that cannot survive it.
 *
 * The trade is that a second tab on the same room now finds the first tab's seat and
 * rejoins as that player, instead of being offered a fresh one. Holding two seats at once
 * means a private window.
 */
const PREFIX = "stonk:seat:";
const key = (code) => `${PREFIX}${code.toUpperCase()}`;

/**
 * Matches live in server memory and never outlast a sitting by much, so a seat older than
 * this is certainly dead. Storage that cleared itself is what we gave up above; this is
 * what replaces it, or every room ever joined would leave a key behind forever.
 */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** Drops every seat past its age, not just the one being written. */
function sweep(now) {
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const stored = localStorage.key(i);
    if (!stored || !stored.startsWith(PREFIX)) continue;
    try {
      const raw = JSON.parse(localStorage.getItem(stored));
      if (!raw?.savedAt || now - raw.savedAt > MAX_AGE_MS) {
        localStorage.removeItem(stored);
      }
    } catch {
      localStorage.removeItem(stored);
    }
  }
}

export function saveSeat(seat) {
  try {
    const now = Date.now();
    sweep(now);
    localStorage.setItem(key(seat.code), JSON.stringify({ savedAt: now, seat }));
  } catch {
    // A blocked or full store must not stop somebody taking their seat.
  }
}

export function loadSeat(code) {
  try {
    const raw = JSON.parse(localStorage.getItem(key(code)));
    if (!raw?.seat || !raw.savedAt) return null;
    if (Date.now() - raw.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key(code));
      return null;
    }
    return raw.seat;
  } catch {
    return null;
  }
}

/** After leaving for good, so returning to the link does not try a token the server dropped. */
export function clearSeat(code) {
  try {
    localStorage.removeItem(key(code));
  } catch {
    // ignore storage error
  }
}
