import { describe, it, expect } from "vitest";
import { tipCountLine, REGIME_VERDICT, REGIME_PRIMER } from "../lib/regime";

describe("regime.js", () => {
  it("pluralizes tip count copy correctly", () => {
    expect(tipCountLine(1)).toBe("One of you got the truth.");
    expect(tipCountLine(0)).toBe("0 of you got the truth.");
    expect(tipCountLine(3)).toBe("3 of you got the truth.");
  });

  it("provides verdicts for all core market regimes", () => {
    expect(REGIME_VERDICT.PUMP).toBe("It went up. Straight up.");
    expect(REGIME_VERDICT.DUMP).toBe("It bled out.");
    expect(REGIME_VERDICT.CHOP).toBe("It went nowhere, violently.");
    expect(REGIME_VERDICT.RUG).toBe("It was a rug pull.");
    expect(REGIME_VERDICT.SQUEEZE).toBe("The shorts got squeezed.");
  });

  it("provides primers for all core market regimes", () => {
    expect(REGIME_PRIMER.PUMP).toBe("steady upward drift");
    expect(REGIME_PRIMER.DUMP).toBe("steady bleed");
    expect(REGIME_PRIMER.CHOP).toBe("no drift, high volatility");
    expect(REGIME_PRIMER.RUG).toBe("grinds up, then dumps hard");
    expect(REGIME_PRIMER.SQUEEZE).toBe("slow bleed, then rips");
  });
});
