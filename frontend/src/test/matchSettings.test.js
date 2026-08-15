import { describe, it, expect } from "vitest";
import {
  DEFAULTS,
  LIMITS,
  CASH_STEPS,
  PRESETS,
  VOLATILITY_OPTIONS,
  estimateMinutes,
  matchingPreset,
} from "../lib/matchSettings";

describe("matchSettings.js", () => {
  it("provides valid default match configuration", () => {
    expect(DEFAULTS.rounds).toBe(5);
    expect(DEFAULTS.roundSeconds).toBe(90);
    expect(DEFAULTS.intermissionSeconds).toBe(25);
    expect(DEFAULTS.startingCash).toBe(10000);
    expect(DEFAULTS.volatilityMultiplier).toBe(1.0);
  });

  it("defines safe boundary limits for match controls", () => {
    expect(LIMITS.rounds.min).toBe(1);
    expect(LIMITS.rounds.max).toBe(8);
    expect(LIMITS.roundSeconds.min).toBe(10);
    expect(LIMITS.roundSeconds.max).toBe(180);
    expect(LIMITS.maxPlayers.max).toBe(12);
  });

  it("defines cash steps and volatility options", () => {
    expect(CASH_STEPS).toContain(10000);
    expect(VOLATILITY_OPTIONS.length).toBe(4);
    expect(VOLATILITY_OPTIONS.some((v) => v.value === 1.0)).toBe(true);
    expect(PRESETS.length).toBe(4);
  });

  it("estimates match length in minutes correctly", () => {
    // 5 rounds of (90s round + 30s intermission) = 5 * 120s = 600s = 10 minutes
    expect(estimateMinutes({ rounds: 5, roundSeconds: 90, intermissionSeconds: 30 })).toBe(10);
    expect(estimateMinutes({ rounds: 1, roundSeconds: 10, intermissionSeconds: 5 })).toBe(1);
  });

  it("finds matching lobby presets", () => {
    expect(matchingPreset({ rounds: 3, roundSeconds: 30 })?.id).toBe("blitz");
    expect(matchingPreset({ rounds: 3, roundSeconds: 60 })?.id).toBe("quick");
    expect(matchingPreset({ rounds: 5, roundSeconds: 90 })?.id).toBe("standard");
    expect(matchingPreset({ rounds: 7, roundSeconds: 120 })?.id).toBe("marathon");
    expect(matchingPreset({ rounds: 4, roundSeconds: 50 })).toBeNull();
  });
});
