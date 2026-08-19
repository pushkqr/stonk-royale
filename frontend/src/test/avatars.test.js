import { describe, it, expect, beforeEach } from "vitest";
import {
  ARCHETYPES,
  getMyAvatar,
  setMyAvatar,
  avatarOf,
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
      expect(a.print).toBeDefined();
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

  it("takes the avatar from the row the server sent", () => {
    expect(avatarOf({ playerId: "p1", avatar: "degen" })).toBe("degen");
  });

  it("falls back rather than rendering nothing for a row with no avatar", () => {
    expect(avatarOf({ playerId: "p1" })).toBe("banker");
    expect(avatarOf({ playerId: "p1", avatar: "not-an-archetype" })).toBe("banker");
    expect(avatarOf(undefined)).toBe("banker");
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
