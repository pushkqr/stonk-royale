/**
 * Seats are kept per match code so a refresh mid-game rejoins rather than losing your
 * place — the server keeps the token valid for the life of the match.
 */
const key = (code) => `stonk:seat:${code.toUpperCase()}`;

export function saveSeat(seat) {
  sessionStorage.setItem(key(seat.code), JSON.stringify(seat));
}

export function loadSeat(code) {
  try {
    return JSON.parse(sessionStorage.getItem(key(code)));
  } catch {
    return null;
  }
}
