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

export default function RulesContent({ modifier, modifierLabel, modifierBlurb }) {
  const variant = modifier && modifier !== "NONE" ? { modifierLabel, modifierBlurb } : null;

  return (
    <div className="rules stack">
      {/* First, and only when one is on. A variant rewrites a rule the rest of this page
          states plainly, so a player who reads past it has been told something false. */}
      {variant && (
        <section className="rules-block rules-variant">
          <h3 className="display rules-head">
            Variant: {variant.modifierLabel}
          </h3>
          <p>{variant.modifierBlurb}</p>
        </section>
      )}
      <section className="rules-block">
        <h3 className="display rules-head">How a round goes</h3>
        <ol className="rules-list">
          <li>
            <b>Talk.</b> The next coin is revealed and you get a private tip naming how it
            will move. The room is told how many tips are true — never all of them.
          </li>
          <li>
            <b>Trade.</b> The market opens. Go long or short and ride it. Big trades push
            the price themselves, briefly — the room's own buying and selling is part of
            what moves the chart, not just the hidden regime underneath it.
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
        <h3 className="display rules-head">Tips lie</h3>
        <p>
          Your tip is yours alone, and most tips are false. At least one in the room is
          always real, and before the market opens everyone is told how many that is — which
          is what makes talking worth anything. Three people claiming PUMP against a count of
          one means two of them are lying to you right now.
        </p>
        <p className="muted">
          You find out whether yours was true when the round settles, alongside what everyone
          claimed theirs said.
        </p>
      </section>

      <section className="rules-block">
        <h3 className="display rules-head">Headlines are not proof</h3>
        <p>
          Two headlines break on the wire every round, to everybody at once. One is true and
          one is not, every time — so a headline landing is never itself a signal, and the
          work is deciding which of the pair you believe.
        </p>
        <p className="muted">
          When a round is about to lurch, the true one lands a beat before it does. That beat
          is the only warning anybody gets.
        </p>
      </section>

      <section className="rules-block">
        <h3 className="display rules-head">Leverage</h3>
        <p>
          One position at a time, 1x to 10x. Higher leverage multiplies the move both ways
          and liquidates you sooner — at 10x, a 9% move against you wipes the position. Your
          liquidation price is drawn on the chart, so it is never a surprise.
        </p>
      </section>

      {/*
        Hidden from touch devices in CSS, where none of it is reachable.

        The deck already prints these on its buttons, at 0.55rem, which is the only place
        they have ever appeared — so the players who trade in two keystrokes are simply the
        ones who happened to look closely, and everyone else reaches for a pointer for the
        whole match. That is a gap in what people were told, not in how well they play, and
        the briefing every new player is made to scroll through is where it closes.
      */}
      <section className="rules-block rules-keys">
        <h3 className="display rules-head">Keys</h3>
        <p className="muted">
          The market moves while your hand does. These do the same job as the buttons,
          without leaving the chart.
        </p>
        <ul className="rules-key-list">
          {[
            { keys: ["1", "2", "3"], does: "Load a preset" },
            { keys: ["L", "↑"], does: "Go long" },
            { keys: ["S", "↓"], does: "Go short" },
            { keys: ["Space", "C"], does: "Close the position" },
          ].map(({ keys, does }) => (
            <li key={does}>
              <span className="rules-key-caps">
                {keys.map((k) => (
                  <kbd className="keycap" key={k}>{k}</kbd>
                ))}
              </span>
              <span className="muted">{does}</span>
            </li>
          ))}
        </ul>
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
