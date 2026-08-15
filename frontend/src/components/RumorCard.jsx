import { REGIME_PRIMER } from "../lib/regime";

/**
 * The signature element.
 *
 * Your rumour is dealt like a role card in a social deduction game, because that is what
 * it is — most of them are lies, and the only way to find out is to talk. At the next
 * intermission the same card comes back with a stamp on it.
 *
 * `compact` is the rail variant: same card, no rotation and no drop shadow, because a
 * tilted card in a 14rem column collides with its neighbours.
 */
export default function RumorCard({ text, stamp, claimedRegime, compact = false }) {
  if (!text) return null;

  return (
    <figure
      className={`rumor ${stamp ? "rumor-stamped rumor-reveal-flip" : ""} ${
        compact ? "rumor-compact" : ""
      }`}
    >
      <figcaption className="eyebrow rumor-eyebrow">Word on the street</figcaption>
      <blockquote className="rumor-text">{text}</blockquote>

      {/* The claim is already readable off the text. Naming it removes the decode step
          without telling the player anything the prose did not. */}
      {claimedRegime ? (
        <p className="rumor-claim mono">
          <span className="rumor-claim-regime">Claims: {claimedRegime}</span>
          {REGIME_PRIMER[claimedRegime] && <> — {REGIME_PRIMER[claimedRegime]}</>}
        </p>
      ) : (
        <p className="rumor-source mono">— someone who probably knows</p>
      )}

      {stamp && (
        <div className={`stamp stamp-${stamp === "TRUE" ? "true" : "lie"}`} role="status">
          {stamp}
        </div>
      )}
    </figure>
  );
}
