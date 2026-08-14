/**
 * Every rule of the game in one place, rendered both by the pre-match briefing and by the
 * corner tab that reopens it mid-round. One source, because copy that exists twice drifts.
 *
 * No percentages: telling players PUMP's median return turns reading a rumour into a
 * lookup. Shapes are enough to make a tip legible, which is all this needs to do.
 */
const REGIMES = [
  { name: "PUMP", shape: "0,18 12,14 24,10 36,7 48,3", note: "Climbs, and keeps climbing." },
  { name: "DUMP", shape: "0,3 12,7 24,10 36,14 48,18", note: "Bleeds out all round." },
  { name: "CHOP", shape: "0,11 8,4 16,17 24,6 32,16 40,7 48,12", note: "Goes nowhere, violently." },
  { name: "RUG", shape: "0,15 12,10 24,6 30,5 33,19 48,20", note: "Grinds up, then drops off a cliff." },
  { name: "SQUEEZE", shape: "0,8 12,11 24,14 30,15 33,4 48,3", note: "Bleeds quietly, then rips upward." },
];

export default function RulesContent() {
  return (
    <div className="rules stack">
      <section className="rules-block">
        <h3 className="display rules-head">How a round goes</h3>
        <ol className="rules-list">
          <li>
            <b>Talk.</b> The next coin is revealed and you get a private tip naming how it
            will move. The room is told how many tips are true — never all of them.
          </li>
          <li>
            <b>Trade.</b> The market opens. Go long or short and ride it.
          </li>
          <li>
            <b>Settle.</b> Positions close at the buzzer, the real move is revealed, and
            everyone sees whether your tip was true and whether you described it honestly.
          </li>
        </ol>
      </section>

      <section className="rules-block">
        <h3 className="display rules-head">What the tips mean</h3>
        <ul className="rules-regimes">
          {REGIMES.map((regime) => (
            <li key={regime.name}>
              <svg className="rules-spark" viewBox="0 0 48 22" aria-hidden="true">
                <polyline points={regime.shape} />
              </svg>
              <b className="mono">{regime.name}</b>
              <span className="muted">{regime.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rules-block">
        <h3 className="display rules-head">Leverage</h3>
        <p>
          One position at a time, 1x to 10x. Higher leverage multiplies the move both ways
          and liquidates you sooner — at 10x, a 9% move against you wipes the position. Your
          liquidation price is drawn on the chart, so it is never a surprise.
        </p>
      </section>

      <section className="rules-block">
        <h3 className="display rules-head">Winning</h3>
        <p>
          Your score each round is your percentage return, and cash resets every round, so a
          bad round costs you that round and nothing more. Highest total across the match
          wins.
        </p>
        <p className="muted">
          No tip is a free win. Even a true PUMP can end flat — knowing the shape does not
          excuse bad timing.
        </p>
      </section>
    </div>
  );
}
