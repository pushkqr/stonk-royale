import { describe, it, expect, beforeEach } from "vitest";
import {
  ARCHETYPES,
  getMyAvatar,
  setMyAvatar,
  getAvatarForPlayer,
  getMood,
} from "../lib/avatars";

describe("avatars.js", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exports 9 valid archetypes with roles and colors", () => {
    expect(ARCHETYPES.length).toBe(9);
    ARCHETYPES.forEach((a) => {
      expect(a.id).toBeDefined();
      expect(a.name).toBeDefined();
      expect(a.role).toBeDefined();
      expect(a.bg).toBeDefined();
      expect(a.accent).toBeDefined();
    });
  });

  it("handles getMyAvatar and setMyAvatar persistence", () => {
    expect(getMyAvatar()).toBe("banker");

    setMyAvatar("moon");
    expect(getMyAvatar()).toBe("moon");
    expect(localStorage.getItem("stonk:avatar")).toBe("moon");

    // Rejects invalid archetype id
    setMyAvatar("invalid-id");
    expect(getMyAvatar()).toBe("moon");
  });

  it("deterministically hashes rivals and returns consistent avatars", () => {
    const avatar1 = getAvatarForPlayer("player-123", "TraderBob", false);
    const avatar2 = getAvatarForPlayer("player-123", "TraderBob", false);
    expect(avatar1).toBe(avatar2);
    expect(ARCHETYPES.some((a) => a.id === avatar1)).toBe(true);

    // If isMe is true, returns local custom avatar
    setMyAvatar("degen");
    expect(getAvatarForPlayer("player-123", "TraderBob", true)).toBe("degen");
  });

  it("calculates avatar moods correctly based on game context", () => {
    expect(getMood({ isWinner: true })).toBe("laser");
    expect(getMood({ pnl: 0.5 })).toBe("laser");
    expect(getMood({ pnl: -0.4 })).toBe("rekt");
    expect(getMood({ isRekt: true })).toBe("rekt");
    expect(getMood({ wasLie: true })).toBe("liar");
    expect(getMood({ pnl: 0.05 })).toBe("neutral");
  });
});
