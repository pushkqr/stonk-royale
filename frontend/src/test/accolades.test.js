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

  /**
   * The closing screen exists to give everyone at the table a moment. These are the ways it
   * stopped doing that: awards computed independently against one standings array collided
   * on whoever was leading, and nothing ever read the `bot` flag its own doc comment
   * promised. Both were invisible to the tests above, because none of them had more awards
   * available than players to hand them to.
   */
  describe("who is allowed to win what", () => {
    // Four humans, nobody liquidated, and the leader also had the best single round —
    // the shape where every award used to converge on one person.
    const table = [
      { playerId: "p1", nickname: "Ana", totalScore: 40, bestRound: 25 },
      { playerId: "p2", nickname: "Ben", totalScore: 18, bestRound: 11 },
      { playerId: "p3", nickname: "Cal", totalScore: -3, bestRound: 6 },
      { playerId: "p4", nickname: "Dee", totalScore: -9, bestRound: 4 },
    ];
    const anaLiedCalDidNot = [{
      regime: "PUMP",
      results: [
        { playerId: "p1", nickname: "Ana", tipClaim: "PUMP", rumorClaimed: "DUMP" },
        { playerId: "p3", nickname: "Cal", tipClaim: "DUMP", rumorClaimed: "DUMP" },
      ],
    }];

    it("never hands the same player two awards", () => {
      const awards = computeAccolades(table, null, [], {}, anaLiedCalDidNot);
      const winners = awards.map((a) => a.player);

      expect(awards.length).toBeGreaterThan(1);
      expect(new Set(winners).size).toBe(winners.length);
    });

    it("keeps a bot away from the prizes for what a player chose to say", () => {
      // Vega leads on every outcome and is the only one on record as having lied, so both
      // claim-based awards would land on it if bots were eligible.
      const withBots = [
        { playerId: "bot:0", nickname: "Vega", totalScore: 30, bestRound: 30, bot: true },
        { playerId: "p1", nickname: "You", totalScore: 12, bestRound: 12 },
      ];
      const botLied = [{
        regime: "PUMP",
        results: [
          { playerId: "bot:0", nickname: "Vega", tipClaim: "PUMP", rumorClaimed: "DUMP" },
          { playerId: "p1", nickname: "You", tipClaim: "PUMP", rumorClaimed: "PUMP" },
        ],
      }];

      const awards = computeAccolades(withBots, null, [], {}, botLied);

      expect(awards.find((a) => a.id === "mastermind")).toBeUndefined();
      expect(awards.find((a) => a.id === "straight")?.player).toBe("You");
    });

    it("still lets a bot take an award it actually earned", () => {
      // A bot really did take those liquidations, so THE REKT is honest where THE
      // MASTERMIND would not be.
      const awards = computeAccolades(
        [{ playerId: "bot:0", nickname: "Vega", totalScore: -30, bestRound: 0, bot: true },
          { playerId: "p1", nickname: "You", totalScore: 12, bestRound: 12 }],
        null, [], { "bot:0": 3 }, [],
      );

      expect(awards.find((a) => a.id === "rekt")?.player).toBe("Vega");
    });

    it("does not count silence as honesty", () => {
      // Ben and Dee never went on record at all. Never lying is only an achievement for
      // someone who spoke.
      const awards = computeAccolades(table, null, [], {}, anaLiedCalDidNot);
      const straight = awards.find((a) => a.id === "straight");

      expect(straight?.player).toBe("Cal");
      expect(["Ben", "Dee"]).not.toContain(straight?.player);
    });

    it("does not count one truthful remark in a long match as a record of honesty", () => {
      // Ben is the *only* truthful claimer in a four-round match, and he spoke exactly once.
      // Ranking cannot carry this one — with nobody to outrank, the award either has a
      // threshold or it goes to a player who made a single remark.
      //
      // Ben is given no best round and no profit on purpose. Leave him eligible for
      // anything else and an earlier award takes him off the board, which would let this
      // pass whether the threshold exists or not.
      const twoSeats = [
        { playerId: "p1", nickname: "Ana", totalScore: 40, bestRound: 25 },
        { playerId: "p2", nickname: "Ben", totalScore: -5, bestRound: 0 },
      ];
      const fourRounds = [
        { results: [{ playerId: "p2", nickname: "Ben", tipClaim: "PUMP", rumorClaimed: "PUMP" },
          { playerId: "p1", nickname: "Ana", tipClaim: "PUMP", rumorClaimed: "DUMP" }] },
        { results: [{ playerId: "p1", nickname: "Ana", tipClaim: "PUMP", rumorClaimed: "CHOP" }] },
        { results: [] },
        { results: [] },
      ];

      const awards = computeAccolades(twoSeats, null, [], {}, fourRounds);

      expect(awards.find((a) => a.id === "straight")).toBeUndefined();
    });

    it("has retired second place dressed up as an accolade", () => {
      const awards = computeAccolades(table, null, [], {}, anaLiedCalDidNot);
      expect(awards.find((a) => a.id === "diamond")).toBeUndefined();
    });
  });
});
