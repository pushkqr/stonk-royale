import { deviceId } from "./device";
import { hasSeenBriefing } from "./briefing";
import { getMyAvatar } from "./avatars";

// Relative by default so one build works in dev (via the Vite proxy) and in the single
// container. Set VITE_API_URL only when the API lives on a different host.
const BASE = import.meta.env.VITE_API_URL ?? "/api";

async function post(path, body, token) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    // fetch only rejects when the request never completed at all — offline, DNS, server
    // down. Every browser words that differently and none of them word it for a player.
    throw new Error("Can't reach the server. Check your connection and try again.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? "Something went wrong. Try again.");
  }
  return data;
}

/** Any setting left out of `settings` keeps the server's default. */
export const createMatch = (nickname, settings, token) =>
  post("/match", { nickname, deviceId: deviceId(), avatar: getMyAvatar(), ...settings }, token);

export const joinMatch = (code, nickname, token) =>
  post(`/match/${code}/join`, { nickname, deviceId: deviceId(), avatar: getMyAvatar() }, token);

/** A solo practice match against bots, already started by the time this resolves. */
export const practiceMatch = (nickname, token) =>
  post(
    "/match/practice",
    { nickname, deviceId: deviceId(), skipBriefing: hasSeenBriefing(), avatar: getMyAvatar() },
    token,
  );

/** Joins a public room that is waiting, or opens one already populated with bots. */
export const quickMatch = (nickname, token) =>
  post("/match/quick", { nickname, deviceId: deviceId(), avatar: getMyAvatar() }, token);

/**
 * How the game is running on this device. Fire-and-forget: a failed report must never
 * surface to a player or interrupt a round, so every error is swallowed.
 */
export function reportTelemetry(payload) {
  fetch(`${BASE}/telemetry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

export async function getLobby(code) {
  let res;
  try {
    res = await fetch(`${BASE}/match/${code}`);
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    throw new Error("That code doesn't match a game.");
  }
  return res.json();
}

/** ws:// alongside whatever the API is served over. */
export function socketUrl() {
  const url = new URL(BASE, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/ws`;
  return url.toString();
}
