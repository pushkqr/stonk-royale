/**
 * The receipt for a round's talking: what each player said their tip was, against the one
 * they were actually dealt.
 *
 * Shown at the next intermission, and again on the results screen for the final round —
 * which has no intermission after it, and is the round people lie hardest in.
 */
export default function Ledger({ results, meId }) {
  // Not worth showing if nobody went on record: a table of dashes says nothing.
  if (!results || results.length < 2 || !results.some((r) => r.tipClaim)) return null;

  return (
    <table className="ledger">
      {/* The stamp above means the tip itself was false. This means the player misreported
          it. Same word, different liar, so the table says which one it is about. */}
      <caption className="eyebrow ledger-caption">
        What they told the room their tip said
      </caption>
      <thead>
        <tr>
          <th className="eyebrow">Player</th>
          <th className="eyebrow">Said</th>
          <th className="eyebrow">Held</th>
        </tr>
      </thead>
      <tbody>
        {results.map((row) => {
          const lied = !!row.tipClaim && row.tipClaim !== row.rumorClaimed;
          return (
            <tr
              key={row.playerId}
              className={`${lied ? "is-lie" : ""} ${row.playerId === meId ? "is-me" : ""}`}
            >
              <td className="ledger-name">
                {row.nickname}
                {row.bot && <span className="tag tag-bot">BOT</span>}
              </td>
              <td className="mono">{row.tipClaim ?? "—"}</td>
              <td className="mono ledger-held">
                {row.rumorClaimed}
                {lied && <span className="ledger-verdict"> lied</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
