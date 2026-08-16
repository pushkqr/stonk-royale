const STORAGE_KEY = "stonk:avatar";

export const ARCHETYPES = [
  {
    id: "banker",
    name: "The Suit",
    role: "Institutional Titan",
    bg: "#1e293b",
    accent: "#f59e0b",
    accessory: "tophat",
  },
  {
    id: "ape",
    name: "Diamond Ape",
    role: "HODL Heavyweight",
    bg: "#451a03",
    accent: "#00e699",
    accessory: "headband",
  },
  {
    id: "moon",
    name: "Moon Cadet",
    role: "Orbit Explorer",
    bg: "#0369a1",
    accent: "#ffde59",
    accessory: "helmet",
  },
  {
    id: "insider",
    name: "Shadow Fed",
    role: "Whisper Network",
    bg: "#090d16",
    accent: "#ff3b54",
    accessory: "fedora",
  },
  {
    id: "quant",
    name: "Quant Wizard",
    role: "High-Freq Algo",
    bg: "#064e3b",
    accent: "#34d399",
    accessory: "glasses",
  },
  {
    id: "bull",
    name: "Giga Bull",
    role: "Perma-Long Beast",
    bg: "#065f46",
    accent: "#10b981",
    accessory: "horns",
  },
  {
    id: "bear",
    name: "Doom Bear",
    role: "Puts Harvester",
    bg: "#7f1d1d",
    accent: "#ef4444",
    accessory: "ears",
  },
  {
    id: "degen",
    name: "Turbo Degen",
    role: "Leverage Fiend",
    bg: "#581c87",
    accent: "#f43f5e",
    accessory: "beanie",
  },
  {
    id: "whale",
    name: "Apex Whale",
    role: "Liquidity Mover",
    bg: "#0c4a6e",
    accent: "#38bdf8",
    accessory: "crown",
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

export function hashString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getAvatarForPlayer(playerId, nickname = "", isMe = false) {
  if (isMe) return getMyAvatar();
  const seed = playerId || nickname || "anon";
  const index = hashString(seed) % ARCHETYPES.length;
  return ARCHETYPES[index].id;
}

export function getMood({ pnl, wasLie, isWinner, isRekt } = {}) {
  if (isWinner || (pnl != null && pnl >= 0.25)) return "laser";
  if (isRekt || (pnl != null && pnl <= -0.25)) return "rekt";
  if (wasLie) return "liar";
  return "neutral";
}
