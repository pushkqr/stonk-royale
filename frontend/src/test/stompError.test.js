import { describe, it, expect } from "vitest";
import { isSeatExpired } from "../lib/stompError";

/**
 * Spelled out rather than imported from the constant on purpose. This is the string
 * StompAuthInterceptor.java throws and WebSocketConfig passes through verbatim, so writing
 * it in full is what makes renaming the code on one side alone fail here instead of
 * silently breaking reconnection in production.
 */
const DEAD_SEAT = {
  headers: { message: "SEAT_EXPIRED: unknown or expired session token" },
  body: "",
};

describe("stompError.js", () => {
  it("recognises the rejection the server sends for a token it no longer holds", () => {
    expect(isSeatExpired(DEAD_SEAT)).toBe(true);
  });

  it("leaves the ordinary messaging failures alone, because those are worth retrying", () => {
    // Every one of these matched the loose prose test this replaced, and every one of them
    // threw a player who still had a live seat out of their room.
    const retryable = [
      "Failed to send message to ExecutorSubscribableChannel",
      "Session closed",
      "No matching message handler",
      "Processing error",
    ];

    for (const message of retryable) {
      expect(isSeatExpired({ headers: { message } })).toBe(false);
    }
  });
});
