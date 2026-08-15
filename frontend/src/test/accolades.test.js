import { describe, it, expect } from "vitest";
import { computeAccolades } from "../lib/accolades";

describe("accolades.js", () => {
  const standings = [
    { playerId: "p1", nickname: "Alice", totalScore: 80, bestRound: 50, bot: false },
    { playerId: "p2", nickname: "Bob", totalScore: 40, bestRound: 30, bot: false },
    { playerId: "p3", nickname: "Charlie", totalScore: -20, bestRound: 10, bot: true },
  ];

  const settled = {
    roundIndex: 4,
    regime: "PUMP",
    results: [
      {
        playerId: "p1",
        nickname: "Alice",
        roundScore: 30,
        totalScore: 80,
        liquidations: 0,
        rumorClaimed: "PUMP",
        tipClaim: "PUMP",
      },
      {
        playerId: "p2",
        nickname: "Bob",
        roundScore: 20,
        totalScore: 40,
        liquidations: 0,
        rumorClaimed: "DUMP",
        tipClaim: "PUMP",
      },
    ],
  };

  const feed = [
    { kind: "LIQUIDATION", playerId: "p3" },
    { kind: "LIQUIDATION", playerId: "p3" },
  ];

  it("computes oracle, rekt, and mastermind accolades accurately", () => {
    const awards = computeAccolades(standings, settled, feed);
    expect(awards.some((a) => a.id === "oracle" && a.player === "Alice")).toBe(true);
    expect(awards.some((a) => a.id === "rekt" && a.player === "Charlie")).toBe(true);
    expect(awards.some((a) => a.id === "mastermind" && a.player === "Bob")).toBe(true);
  });

  it("handles empty standings gracefully", () => {
    expect(computeAccolades([], null, [])).toEqual([]);
  });
});
