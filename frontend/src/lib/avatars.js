const STORAGE_KEY = "stonk:avatar";

/**
 * Nine player marks. `accent` draws the silhouette; `print` draws the same silhouette
 * offset behind it, the trick the $ in favicon.svg uses — it is what ties these to the
 * logo rather than to a generic avatar pack. Both values are game tokens from index.css.
 * The previous set was stock Tailwind (#1e293b, #f59e0b, #38bdf8 …); exactly one colour
 * in it belonged to this game, which is why the avatars never looked like they were part
 * of it.
 */
export const ARCHETYPES = [
  {
    id: "banker",
    name: "The Suit",
    role: "Institutional Titan",
    accent: "#ffe81a",
    print: "#ff3b54",
  },
  {
    id: "ape",
    name: "Diamond Ape",
    role: "HODL Heavyweight",
    accent: "#21e07a",
    print: "#ffe81a",
  },
  {
    id: "moon",
    name: "Moon Cadet",
    role: "Orbit Explorer",
    accent: "#fff4e0",
    print: "#9e7ebb",
  },
  {
    id: "insider",
    name: "Shadow Fed",
    role: "Whisper Network",
    accent: "#ff3b54",
    print: "#56287a",
  },
  {
    id: "quant",
    name: "Quant Wizard",
    role: "High-Freq Algo",
    accent: "#9e7ebb",
    print: "#21e07a",
  },
  {
    id: "bull",
    name: "Giga Bull",
    role: "Perma-Long Beast",
    accent: "#21e07a",
    print: "#fff4e0",
  },
  {
    id: "bear",
    name: "Doom Bear",
    role: "Puts Harvester",
    accent: "#ff3b54",
    print: "#ffe81a",
  },
  {
    id: "degen",
    name: "Turbo Degen",
    role: "Leverage Fiend",
    accent: "#ffe81a",
    print: "#21e07a",
  },
  {
    id: "whale",
    name: "Apex Whale",
    role: "Liquidity Mover",
    accent: "#9e7ebb",
    print: "#fff4e0",
  },
];

export function getMyAvatar() {
  if (typeof localStorage === "undefined") return "banker";
  const saved = localStorage.getItem(STORAGE_KEY);
  return ARCHETYPES.some((a) => a.id === saved) ? saved : "banker";
}

export function setMyAvatar(id) {
  if (typeof localStorage !== "undefined" && ARCHETYPES.some((a) => a.id === id)) {
    localStorage.setItem(STORAGE_KEY, id);
  }
}

/**
 * The mark to draw for a player, taken from the row the server sent. Avatars used to be
 * hashed from the playerId on each client, which is why two people looking at the same
 * player saw different marks. The server now owns this; the fallback is only for a row
 * that arrived before the field existed, e.g. mid-deploy.
 */
export function avatarOf(row) {
  const id = row?.avatar;
  return ARCHETYPES.some((a) => a.id === id) ? id : "banker";
}

export function getMood({ pnl, wasLie, isWinner, isRekt } = {}) {
  if (isWinner || (pnl != null && pnl >= 0.25)) return "laser";
  if (isRekt || (pnl != null && pnl <= -0.25)) return "rekt";
  if (wasLie) return "liar";
  return "neutral";
}
