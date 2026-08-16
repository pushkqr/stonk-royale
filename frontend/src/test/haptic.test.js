import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { haptic } from "../lib/haptic";
import { setMuted } from "../lib/sound";

describe("haptic.js", () => {
  let originalVibrate;

  beforeEach(() => {
    setMuted(false);
    originalVibrate = navigator.vibrate;
    navigator.vibrate = vi.fn();
    Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true });
  });

  afterEach(() => {
    if (originalVibrate) {
      navigator.vibrate = originalVibrate;
    } else {
      delete navigator.vibrate;
    }
    setMuted(false);
  });

  it("invokes navigator.vibrate with correct patterns for all haptic cues", () => {
    haptic.tap();
    expect(navigator.vibrate).toHaveBeenCalledWith(10);

    haptic.trade();
    expect(navigator.vibrate).toHaveBeenCalledWith(15);

    haptic.success();
    expect(navigator.vibrate).toHaveBeenCalledWith([15, 30, 25]);

    haptic.loss();
    expect(navigator.vibrate).toHaveBeenCalledWith([35, 45]);

    haptic.liquidate();
    expect(navigator.vibrate).toHaveBeenCalledWith([60, 40, 90]);

    haptic.tick();
    expect(navigator.vibrate).toHaveBeenCalledWith(6);

    haptic.cancel();
    expect(navigator.vibrate).toHaveBeenCalledWith(0);
  });

  it("suppresses haptics when sound/haptics are muted", () => {
    setMuted(true);
    haptic.tap();
    haptic.trade();
    haptic.success();
    haptic.liquidate();

    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it("suppresses haptics when document is hidden (background tab)", () => {
    Object.defineProperty(document, "hidden", { value: true, writable: true, configurable: true });
    haptic.tap();
    haptic.trade();
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it("handles navigator.vibrate throwing gracefully", () => {
    navigator.vibrate = vi.fn().mockImplementation(() => {
      throw new Error("Vibration permission denied");
    });

    expect(() => {
      haptic.tap();
      haptic.trade();
      haptic.success();
      haptic.loss();
      haptic.liquidate();
      haptic.tick();
      haptic.cancel();
    }).not.toThrow();
  });
});
