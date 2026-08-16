/**
 * Regime copy shared by the intermission and the mid-round dossier.
 *
 * It lives here rather than in either component because both screens name the same five
 * regimes, and copy duplicated across two files is copy that drifts apart.
 */

/** What the round actually turned out to be, in the game's own voice. */
export const REGIME_VERDICT = {
  PUMP: "It went up. Straight up.",
  DUMP: "It bled out.",
  CHOP: "It went nowhere, violently.",
  RUG: "It was a rug pull.",
  SQUEEZE: "The shorts got squeezed.",
};

/**
 * What a regime does to a chart, in as few words as fit a 14rem column. Shown beside a
 * tip's claim so reading it is one step instead of three.
 */
export const REGIME_PRIMER = {
  PUMP: "steady upward drift",
  DUMP: "steady bleed",
  CHOP: "no drift, high volatility",
  RUG: "grinds up, then dumps hard",
  SQUEEZE: "slow bleed, then rips",
};

/**
 * Actionable trading bias prescribed by a rumor claim.
 */
export const REGIME_BIAS = {
  PUMP: { label: "BIAS: GO LONG", tone: "pump", desc: "Long on dips" },
  DUMP: { label: "BIAS: GO SHORT", tone: "dump", desc: "Short on pops" },
  CHOP: { label: "BIAS: SCALP ONLY", tone: "muted", desc: "Quick in and out" },
  RUG: { label: "WARNING: RUG PULL", tone: "dump", desc: "Pumps then collapses" },
  SQUEEZE: { label: "ALERT: SHORT SQUEEZE", tone: "pump", desc: "Bleeds then violent rip" },
};

/**
 * The one fact everybody shares. It makes the wire checkable: if four people claim a pump
 * and only one tip is true, three of them are lying where you can see it. Never zero — the
 * server guarantees a round holds at least one real tip.
 */
export function tipCountLine(count) {
  if (count === 1) return "One of you got the truth.";
  return `${count} of you got the truth.`;
}

/**
 * Categorizes a player's round performance relative to the truthfulness of their rumor.
 */
export function deductionVerdict(myResult, settledRegime) {
  if (!myResult) return null;
  const { rumorWasTrue, roundScore, rumorClaimed } = myResult;
  const isPositive = (roundScore || 0) > 0;
  const isFlat = Math.abs(roundScore || 0) < 0.0001;

  if (isFlat) {
    return {
      tag: "RISK-OFF",
      tone: "muted",
      summary: `You stayed flat with zero exposure. The market was ${settledRegime || "unknown"}.`,
    };
  }
  if (rumorWasTrue && isPositive) {
    return {
      tag: "INSIDER ALPHA",
      tone: "pump",
      summary: "You trusted real insider alpha and rode the wave to profit.",
    };
  }
  if (!rumorWasTrue && !isPositive) {
    return {
      tag: "BAMBOOZLED",
      tone: "dump",
      summary: `You fell for the fake ${rumorClaimed || "market"} leak. Disinformation won.`,
    };
  }
  if (!rumorWasTrue && isPositive) {
    return {
      tag: "BIG BRAIN CONTRARIAN",
      tone: "pump",
      summary: "You sniffed out the fake tip and traded against the herd!",
    };
  }
  return {
    tag: "WRONG-FOOTED",
    tone: "dump",
    summary: `Market was ${settledRegime || "volatile"}. Tip was ${rumorWasTrue ? "True" : "Fake"}.`,
  };
}
