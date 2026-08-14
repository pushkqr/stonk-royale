import { memo } from "react";
import { money, pct, toneOf } from "../lib/format";

/**
 * Memoised because it hangs off the trading screen, which re-renders on every price tick.
 * The board behind it only lands twice a second, so most of those renders would redraw an
 * identical table.
 */
function Standings({ rows, meId }) {
  return (
    <section className="panel stack rail">
      <header className="panel-head">
        <h2 className="display pane-title">Standings</h2>
      </header>

      <ol className="rank-list">
        {rows.map((row, i) => (
          <li key={row.playerId} className={`rank ${row.playerId === meId ? "rank-me" : ""}`}>
            <span className="rank-no display">{i + 1}</span>

            {/* The live round score leads, because it's the number that moves. The
                cumulative total only appears once there's a previous round in it. */}
            <span className="rank-body">
              <span className="rank-name">{row.nickname}</span>
              <span className="rank-scores">
                <span className={`rank-score mono ${toneOf(row.roundScore)}`}>
                  {pct(row.roundScore)}
                </span>
                {row.totalScore !== 0 && (
                  <span className="rank-total mono muted">{pct(row.totalScore)} all</span>
                )}
              </span>
            </span>

            {row.position ? (
              <span className={`tag tag-${row.position.side === "LONG" ? "pump" : "dump"}`}>
                {row.position.leverage}x {row.position.side}
              </span>
            ) : (
              <span className="rank-cash mono muted">{money(row.equity)}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default memo(Standings);
