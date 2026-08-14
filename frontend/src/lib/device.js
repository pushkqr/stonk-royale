/**
 * A per-browser id, generated once and kept.
 *
 * Its only job is counting how many distinct people have ever played — nothing in the game
 * reads it, and the server never ties it to a nickname or a seat. Someone who clears their
 * storage or plays on a second browser counts twice, which is fine: this is a rough measure
 * of reach, not an identity.
 */
const KEY = "stonk:device";

export function deviceId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Storage denied in private browsing. Every visit counts as a new device, which is
    // wrong but harmless, and better than failing a join over a statistic.
    return null;
  }
}
