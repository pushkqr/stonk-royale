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
    { kind: "TRADE", playerId: "p1" },
    { kind: "TRADE", playerId: "p1" },
  ];

  it("computes oracle, rekt, mastermind, and survivor/degen accolades accurately", () => {
    const awards = computeAccolades(standings, settled, feed);
    expect(awards.length).toBeLessThanOrEqual(4);
    expect(awards.some((a) => a.id === "oracle" && a.player === "Alice")).toBe(true);
    expect(awards.some((a) => a.id === "rekt" && a.player === "Charlie")).toBe(true);
    expect(awards.some((a) => a.id === "mastermind" && a.player === "Bob")).toBe(true);
  });

  it("accurately uses matchLiquidations map when provided, even if feed is truncated", () => {
    const awards = computeAccolades(standings, settled, [], { p3: 4 });
    const rekt = awards.find((a) => a.id === "rekt");
    expect(rekt).toBeDefined();
    expect(rekt.player).toBe("Charlie");
    expect(rekt.subtitle).toBe("4 liquidations suffered");
  });

  it("handles empty standings gracefully", () => {
    expect(computeAccolades([], null, [])).toEqual([]);
  });

  it("gives the Mastermind to the match's most persistent liar, not the last round's", () => {
    // Alice lies in rounds 1 and 2 then goes straight; Bob lies only in the final round.
    const history = [
      {
        roundIndex: 0,
        results: [
          { playerId: "p1", nickname: "Alice", rumorClaimed: "PUMP", tipClaim: "DUMP" },
          { playerId: "p2", nickname: "Bob", rumorClaimed: "PUMP", tipClaim: "PUMP" },
        ],
      },
      {
        roundIndex: 1,
        results: [
          { playerId: "p1", nickname: "Alice", rumorClaimed: "DUMP", tipClaim: "PUMP" },
          { playerId: "p2", nickname: "Bob", rumorClaimed: "PUMP", tipClaim: "PUMP" },
        ],
      },
      settled,
    ];

    const awards = computeAccolades(standings, settled, feed, {}, history);
    const mastermind = awards.find((a) => a.id === "mastermind");

    expect(mastermind).toBeDefined();
    expect(mastermind.player).toBe("Alice");
    expect(mastermind.subtitle).toBe("Lied in 2 of 3 rounds");
  });
});
