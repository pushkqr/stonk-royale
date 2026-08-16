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
    expect(REGIME_PRIMER.PUMP).toBe("steady upward drift");
    expect(REGIME_PRIMER.DUMP).toBe("steady bleed");
    expect(REGIME_PRIMER.CHOP).toBe("no drift, high volatility");
    expect(REGIME_PRIMER.RUG).toBe("grinds up, then dumps hard");
    expect(REGIME_PRIMER.SQUEEZE).toBe("slow bleed, then rips");
  });

  it("provides trade bias definitions for all core market regimes", () => {
    expect(REGIME_BIAS.PUMP.label).toBe("BIAS: GO LONG");
    expect(REGIME_BIAS.DUMP.label).toBe("BIAS: GO SHORT");
    expect(REGIME_BIAS.CHOP.label).toBe("BIAS: SCALP ONLY");
    expect(REGIME_BIAS.RUG.label).toBe("WARNING: RUG PULL");
    expect(REGIME_BIAS.SQUEEZE.label).toBe("ALERT: SHORT SQUEEZE");
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

    // 2 matching headlines (confirmed alpha)
    const confirmed = evaluateCrossCheck("PUMP", [
      "$NVDA NAMED TOP PICK BY MAJOR DESK",
      "INSTITUTIONAL INFLOWS INTO $NVDA HIT RECORD",
    ]);
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.tone).toBe("pump");

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
    const alpha = deductionVerdict({ rumorWasTrue: true, roundScore: 0.15, rumorClaimed: "PUMP" }, "PUMP");
    expect(alpha.tag).toBe("INSIDER ALPHA");
    expect(alpha.tone).toBe("pump");

    // 2. Bamboozled (Fake tip + loss)
    const bamboozled = deductionVerdict({ rumorWasTrue: false, roundScore: -0.2, rumorClaimed: "PUMP" }, "DUMP");
    expect(bamboozled.tag).toBe("BAMBOOZLED");
    expect(bamboozled.tone).toBe("dump");

    // 3. Big brain contrarian (Fake tip + profit)
    const contrarian = deductionVerdict({ rumorWasTrue: false, roundScore: 0.35, rumorClaimed: "DUMP" }, "PUMP");
    expect(contrarian.tag).toBe("BIG BRAIN CONTRARIAN");
    expect(contrarian.tone).toBe("pump");

    // 4. Risk off (Flat / zero score)
    const flat = deductionVerdict({ rumorWasTrue: true, roundScore: 0, rumorClaimed: "PUMP" }, "PUMP");
    expect(flat.tag).toBe("RISK-OFF");
    expect(flat.tone).toBe("muted");

    // 5. Null result returns null
    expect(deductionVerdict(null, "PUMP")).toBeNull();
  });
});
