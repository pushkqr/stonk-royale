import { describe, it, expect } from "vitest";
import {
  tipCountLine,
  REGIME_VERDICT,
  REGIME_PRIMER,
  REGIME_BIAS,
  deductionVerdict,
  classifyHeadline,
  evaluateCrossCheck,
} from "../lib/regime";

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
    expect(REGIME_PRIMER.PUMP).toBe("goes up steadily");
    expect(REGIME_PRIMER.DUMP).toBe("goes down steadily");
    expect(REGIME_PRIMER.CHOP).toBe("jumps around, ends flat");
    expect(REGIME_PRIMER.RUG).toBe("creeps up, then crashes");
    expect(REGIME_PRIMER.SQUEEZE).toBe("drifts down, then rockets");
  });

  it("provides trade bias definitions for all core market regimes", () => {
    expect(REGIME_BIAS.PUMP.label).toBe("BET IT GOES UP");
    expect(REGIME_BIAS.DUMP.label).toBe("BET IT GOES DOWN");
    expect(REGIME_BIAS.CHOP.label).toBe("GET IN AND OUT FAST");
    expect(REGIME_BIAS.RUG.label).toBe("IT RISES, THEN CRASHES");
    expect(REGIME_BIAS.SQUEEZE.label).toBe("IT FALLS, THEN ROCKETS");
  });

  it("classifies market headlines into matching regimes", () => {
    expect(classifyHeadline("$NVDA NAMED TOP PICK BY MAJOR DESK")).toBe("PUMP");
    expect(classifyHeadline("INSTITUTIONAL INFLOWS INTO $BTC HIT RECORD")).toBe("PUMP");
    expect(classifyHeadline("$TSLA DOWNGRADED ACROSS THE STREET")).toBe("DUMP");
    expect(classifyHeadline("EARLY BACKERS SEEN EXITING $MEME")).toBe("DUMP");
    expect(classifyHeadline("$ETH VOLUME DRIES UP, TRADERS SIDELINED")).toBe("CHOP");
    expect(classifyHeadline("ANALYSTS SPLIT ON $SOL, NO CONSENSUS")).toBe("CHOP");
    expect(classifyHeadline("$DOGE DEV WALLET MOVING")).toBe("RUG");
    expect(classifyHeadline("REGULATORS OPEN PROBE INTO $X")).toBe("RUG");
    expect(classifyHeadline("$GME SHORT INTEREST HITS ALL-TIME HIGH")).toBe("SQUEEZE");
    expect(classifyHeadline("$AMC FLOAT LOCKED UP, BORROW UNAVAILABLE")).toBe("SQUEEZE");
    expect(classifyHeadline("Random unrelated tweet")).toBeNull();
  });

  it("evaluates live cross-checks between tip and news headlines", () => {
    // Single matching headline
    const match = evaluateCrossCheck("PUMP", ["$NVDA NAMED TOP PICK BY MAJOR DESK"]);
    expect(match.status).toBe("MATCHING");
    expect(match.tone).toBe("pump");

    // Single conflicting headline
    const conflict = evaluateCrossCheck("PUMP", ["$TSLA DOWNGRADED ACROSS THE STREET"]);
    expect(conflict.status).toBe("CONFLICTING");
    expect(conflict.tone).toBe("dump");

    // 2 headlines: 1 match, 1 conflict (mixed signals)
    const mixed = evaluateCrossCheck("PUMP", [
      "$NVDA NAMED TOP PICK BY MAJOR DESK",
      "$TSLA DOWNGRADED ACROSS THE STREET",
    ]);
    expect(mixed.status).toBe("MIXED");
    expect(mixed.tone).toBe("scream");

    // 2 matching headlines. Never a confirmation: one of a round's two headlines is
    // always the planted lie, so this must not read as conviction.
    const aligned = evaluateCrossCheck("PUMP", [
      "$NVDA NAMED TOP PICK BY MAJOR DESK",
      "INSTITUTIONAL INFLOWS INTO $NVDA HIT RECORD",
    ]);
    expect(aligned.status).toBe("ALIGNED");
    expect(aligned.tone).toBe("scream");
    expect(aligned.text).toMatch(/always fake/i);

    // 2 conflicting headlines (exposed lie)
    const exposed = evaluateCrossCheck("PUMP", [
      "$TSLA DOWNGRADED ACROSS THE STREET",
      "EARLY BACKERS SEEN EXITING $TSLA",
    ]);
    expect(exposed.status).toBe("EXPOSED");
    expect(exposed.tone).toBe("dump");
  });

  it("calculates deduction verdicts accurately across player outcomes", () => {
    // 1. Insider alpha (True tip + profit)
    const alpha = deductionVerdict({ rumorWasTrue: true, roundScore: 0.15, rumorClaimed: "PUMP" });
    expect(alpha.tag).toBe("INSIDER ALPHA");
    expect(alpha.tone).toBe("pump");

    // 2. Bamboozled (Fake tip + loss)
    const bamboozled = deductionVerdict({ rumorWasTrue: false, roundScore: -0.2, rumorClaimed: "PUMP" });
    expect(bamboozled.tag).toBe("BAMBOOZLED");
    expect(bamboozled.tone).toBe("dump");

    // 3. Big brain contrarian (Fake tip + profit)
    const contrarian = deductionVerdict({ rumorWasTrue: false, roundScore: 0.35, rumorClaimed: "DUMP" });
    expect(contrarian.tag).toBe("BIG BRAIN CONTRARIAN");
    expect(contrarian.tone).toBe("pump");

    // 4. Risk off (Flat / zero score)
    const flat = deductionVerdict({ rumorWasTrue: true, roundScore: 0, rumorClaimed: "PUMP" });
    expect(flat.tag).toBe("RISK-OFF");
    expect(flat.tone).toBe("muted");

    // 5. Wrong-footed (True tip + loss) — the branch every other case falls through to,
    // and the only one that had no test at all.
    const wrongFooted = deductionVerdict({ rumorWasTrue: true, roundScore: -0.1, rumorClaimed: "PUMP" });
    expect(wrongFooted.tag).toBe("WRONG-FOOTED");
    expect(wrongFooted.tone).toBe("dump");

    // 6. Null result returns null
    expect(deductionVerdict(null)).toBeNull();
  });

  it("never spends its one sentence on something already on the screen", () => {
    // The regime is the headline above this card and the tip's truth is stamped across the
    // card beside it. A summary naming either was the third printing of the same fact.
    const results = [
      { rumorWasTrue: true, roundScore: 0.15, rumorClaimed: "PUMP" },
      { rumorWasTrue: false, roundScore: -0.2, rumorClaimed: "PUMP" },
      { rumorWasTrue: false, roundScore: 0.35, rumorClaimed: "DUMP" },
      { rumorWasTrue: true, roundScore: 0, rumorClaimed: "PUMP" },
      { rumorWasTrue: true, roundScore: -0.1, rumorClaimed: "PUMP" },
    ];

    for (const result of results) {
      const { summary } = deductionVerdict(result);
      expect(summary, `summary for ${result.rumorWasTrue} / ${result.roundScore}`)
        .not.toMatch(/\bmarket was\b|\btip was (true|fake)\b/i);
    }
  });
});
