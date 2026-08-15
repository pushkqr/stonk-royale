import { describe, it, expect } from "vitest";
import { unrealisedPnl, liveRoundScore } from "../lib/pnl";

describe("pnl.js", () => {
  describe("unrealisedPnl", () => {
    it("returns 0 when position is null", () => {
      expect(unrealisedPnl(null, 100)).toBe(0);
    });

    it("calculates LONG profit correctly", () => {
      const position = { side: "LONG", entryPrice: 100, margin: 1000, leverage: 5, liquidationPrice: 82 };
      // 10% price increase with 5x leverage -> 50% profit on margin = $500
      expect(unrealisedPnl(position, 110)).toBeCloseTo(500);
    });

    it("calculates LONG loss correctly", () => {
      const position = { side: "LONG", entryPrice: 100, margin: 1000, leverage: 5, liquidationPrice: 82 };
      // 5% price decrease with 5x leverage -> 25% loss on margin = -$250
      expect(unrealisedPnl(position, 95)).toBeCloseTo(-250);
    });

    it("calculates SHORT profit correctly", () => {
      const position = { side: "SHORT", entryPrice: 100, margin: 1000, leverage: 4, liquidationPrice: 122.5 };
      // 10% price drop with 4x leverage -> 40% profit on margin = $400
      expect(unrealisedPnl(position, 90)).toBeCloseTo(400);
    });

    it("calculates SHORT loss correctly", () => {
      const position = { side: "SHORT", entryPrice: 100, margin: 1000, leverage: 4, liquidationPrice: 122.5 };
      // 10% price rise with 4x leverage -> 40% loss on margin = -$400
      expect(unrealisedPnl(position, 110)).toBeCloseTo(-400);
    });

    it("caps loss at 90% maintenance margin on liquidation breach", () => {
      const position = { side: "LONG", entryPrice: 100, margin: 1000, leverage: 10, liquidationPrice: 91 };
      // 50% price crash with 10x leverage -> loss capped at 90% of margin = -$900
      expect(unrealisedPnl(position, 50)).toBe(-900);
    });
  });

  describe("liveRoundScore", () => {
    it("calculates percentage score based on starting cash", () => {
      const me = {
        cash: 10000,
        position: { side: "LONG", entryPrice: 100, margin: 5000, leverage: 2, liquidationPrice: 55 },
      };
      // Price rises 10% -> 20% on $5,000 margin = $1,000 profit. Equity = $11,000. Score = +10%
      expect(liveRoundScore(me, 110, 10000)).toBeCloseTo(10);
    });

    it("handles zero starting cash safely", () => {
      expect(liveRoundScore({ cash: 0 }, 100, 0)).toBe(0);
    });
  });
});
