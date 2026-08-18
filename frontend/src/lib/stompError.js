/**
 * The one socket failure a client cannot retry its way out of.
 *
 * When the registry no longer holds a token, StompAuthInterceptor rejects the CONNECT and
 * WebSocketConfig's error handler copies the root cause's message into the ERROR frame
 * untouched. That message is the only channel the two ends have, so the code below is a
 * wire contract rather than a detail of this file: it is spelled out literally in a test
 * on each side, because matching the English sentence it used to carry meant that
 * rewording a Java exception would silently disable the only path back into a room.
 */
export const SEAT_EXPIRED = "SEAT_EXPIRED";

/**
 * True only for that rejection. Every other socket error is worth retrying, and treating
 * one as fatal throws a player who still has a live seat out of the game.
 */
export function isSeatExpired(frame) {
  const header = frame?.headers?.message ?? "";
  const body = frame?.body ?? "";
  return `${header} ${body}`.toUpperCase().includes(SEAT_EXPIRED);
}
