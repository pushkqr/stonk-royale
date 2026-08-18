import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sound, isMuted, setMuted, toggle, bgm, duckBgm } from "../lib/sound";

describe("sound.js", () => {
  beforeEach(() => {
    localStorage.clear();
    setMuted(false);
    bgm.stop();
  });

  afterEach(() => {
    bgm.stop();
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

  it("controls procedural Wall Street Arcade BGM engine state and modes", () => {
    expect(bgm.isActive()).toBe(false);

    bgm.start("normal");
    expect(bgm.isActive()).toBe(true);
    expect(bgm.getMode()).toBe("normal");

    bgm.setUrgent(true);
    expect(bgm.getMode()).toBe("urgent");

    bgm.setUrgent(false);
    expect(bgm.getMode()).toBe("normal");

    bgm.duck(0.2, 0.4);

    bgm.stop();
    expect(bgm.isActive()).toBe(false);
  });

  it("runs all sound synthesizer cues safely in headless test environment", () => {
    expect(() => {
      sound.tick(5);
      sound.open("LONG");
      sound.open("SHORT");
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
      sound.bgm.start("normal");
      sound.bgm.setUrgent(true);
      sound.bgm.duck(0.1, 0.5);
      duckBgm(0.3, 0.2);
      sound.bgm.stop();
    }).not.toThrow();
  });

  it("handles document visibility changes cleanly", () => {
    bgm.start("normal");
    expect(bgm.isActive()).toBe(true);

    // Simulate document visibility event
    Object.defineProperty(document, "hidden", { value: true, writable: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(bgm.isActive()).toBe(true);
    bgm.stop();
  });
});
