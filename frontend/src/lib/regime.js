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
 * The one fact everybody shares. It makes the wire checkable: if four people claim a pump
 * and only one tip is true, three of them are lying where you can see it. Never zero — the
 * server guarantees a round holds at least one real tip.
 */
export function tipCountLine(count) {
  if (count === 1) return "One of you got the truth.";
  return `${count} of you got the truth.`;
}
