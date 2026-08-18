import { describe, it, expect, beforeEach } from "vitest";
import { saveSeat, loadSeat, clearSeat } from "../lib/session";

const seat = { code: "ABCDE", playerId: "p1", token: "t1", nickname: "Dave" };

describe("session.js", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns a saved seat for the same room, case-insensitively", () => {
    saveSeat(seat);
    expect(loadSeat("abcde")).toEqual(seat);
  });

  it("returns null for a room that was never joined", () => {
    expect(loadSeat("ZZZZZ")).toBeNull();
  });

  it("does not hand back a seat old enough to be certainly dead", () => {
    const thirteenHoursAgo = Date.now() - 13 * 60 * 60 * 1000;
    localStorage.setItem(
      "stonk:seat:ABCDE",
      JSON.stringify({ savedAt: thirteenHoursAgo, seat }),
    );
    expect(loadSeat("ABCDE")).toBeNull();
  });

  it("sweeps other rooms' expired seats when a new one is saved", () => {
    localStorage.setItem(
      "stonk:seat:OLDCD",
      JSON.stringify({ savedAt: Date.now() - 13 * 60 * 60 * 1000, seat }),
    );
    saveSeat(seat);
    expect(localStorage.getItem("stonk:seat:OLDCD")).toBeNull();
  });

  it("forgets a seat once it is cleared", () => {
    saveSeat(seat);
    clearSeat("ABCDE");
    expect(loadSeat("ABCDE")).toBeNull();
  });
});
