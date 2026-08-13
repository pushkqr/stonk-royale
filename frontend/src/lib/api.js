// Relative by default so one build works in dev (via the Vite proxy) and in the single
// container. Set VITE_API_URL only when the API lives on a different host.
const BASE = import.meta.env.VITE_API_URL ?? "/api";

async function post(path, body, token) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? "Something went wrong. Try again.");
  }
  return data;
}

/** Any setting left out of `settings` keeps the server's default. */
export const createMatch = (nickname, settings, token) =>
  post("/match", { nickname, ...settings }, token);

export const joinMatch = (code, nickname, token) =>
  post(`/match/${code}/join`, { nickname }, token);

/** A one-round solo match, already started by the time this resolves. */
export const practiceMatch = (nickname, token) => post("/match/practice", { nickname }, token);

export async function getLobby(code) {
  const res = await fetch(`${BASE}/match/${code}`);
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
