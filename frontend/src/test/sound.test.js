import { describe, it, expect, beforeEach } from "vitest";
import { sound, isMuted, setMuted, toggle } from "../lib/sound";

describe("sound.js", () => {
  beforeEach(() => {
    localStorage.clear();
    setMuted(false);
  });

  it("handles mute and unmute state transitions", () => {
    expect(isMuted()).toBe(false);

    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(localStorage.getItem("stonk:muted")).toBe("1");

    const toggled = toggle();
    expect(toggled).toBe(false);
    expect(isMuted()).toBe(false);
    expect(localStorage.getItem("stonk:muted")).toBe("0");
  });

  it("runs sound synthesizer calls safely in headless test environment", () => {
    expect(() => {
      sound.tick(5);
      sound.open("LONG");
      sound.open("SHORT");
      sound.trade(true);
      sound.trade(false);
      sound.close(100);
      sound.close(-50);
      sound.liquidation(true);
      sound.liquidation(false);
      sound.roundStart();
      sound.settle(20);
      sound.settle(-10);
      sound.finish(true);
      sound.finish(false);
      sound.deal();
      sound.news();
      sound.chatter();
      sound.ready(0.5);
      sound.stamp(true);
    }).not.toThrow();
  });
});
