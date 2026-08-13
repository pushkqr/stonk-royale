/**
 * The signature element.
 *
 * Your rumour is dealt like a role card in a social deduction game, because that is what
 * it is — most of them are lies, and the only way to find out is to talk. At the next
 * intermission the same card comes back with a stamp on it.
 */
export default function RumorCard({ text, stamp }) {
  if (!text) return null;

  return (
    <figure className={`rumor ${stamp ? "rumor-stamped" : ""}`}>
      <figcaption className="eyebrow rumor-eyebrow">Word on the street</figcaption>
      <blockquote className="rumor-text">{text}</blockquote>
      <p className="rumor-source mono">— someone who probably knows</p>

      {stamp && (
        <div className={`stamp stamp-${stamp === "TRUE" ? "true" : "lie"}`} role="status">
          {stamp}
        </div>
      )}
    </figure>
  );
}
