import { memo, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { money, pct, toneOf } from "../lib/format";
import Avatar from "./Avatar";
import { getAvatarForPlayer, getMood } from "../lib/avatars";

/**
 * Memoised because it hangs off the trading screen, which re-renders on every price tick.
 * The board behind it only lands twice a second, so most of those renders would redraw an
 * identical table.
 */
function Standings({ rows, meId, suspects = {} }) {
  const [prevRows, setPrevRows] = useState(rows);
  const [deltas, setDeltas] = useState({});

  if (rows !== prevRows) {
    const nextDeltas = {};
    const prevMap = new Map();
    prevRows.forEach((r, idx) => prevMap.set(r.playerId, idx + 1));

    rows.forEach((r, idx) => {
      const currentRank = idx + 1;
      if (prevMap.has(r.playerId)) {
        const diff = prevMap.get(r.playerId) - currentRank;
        if (diff !== 0) {
          nextDeltas[r.playerId] = diff;
        }
      }
    });

    setPrevRows(rows);
    setDeltas(nextDeltas);
  }

  return (
    <section className="panel stack rail">
      <header className="panel-head">
        <h2 className="display pane-title">Standings</h2>
      </header>

      <ol className="rank-list">
        {rows.map((row, i) => (
          <li
            key={row.playerId}
            className={`rank ${row.playerId === meId ? "rank-me" : ""} ${row.left ? "is-away" : ""}`}
          >
            <div className="rank-num-col">
              <span className="rank-no display">{i + 1}</span>
              {deltas[row.playerId] != null && deltas[row.playerId] > 0 && (
                <span className="rank-shift is-up" title={`Climbed ${deltas[row.playerId]} places`}>
                  <ChevronUp size={10} strokeWidth={3} />
                  {deltas[row.playerId] > 1 ? deltas[row.playerId] : ""}
                </span>
              )}
              {deltas[row.playerId] != null && deltas[row.playerId] < 0 && (
                <span
                  className="rank-shift is-down"
                  title={`Dropped ${Math.abs(deltas[row.playerId])} places`}
                >
                  <ChevronDown size={10} strokeWidth={3} />
                  {Math.abs(deltas[row.playerId]) > 1 ? Math.abs(deltas[row.playerId]) : ""}
                </span>
              )}
            </div>

            {/* The live round score leads, because it's the number that moves. The
                cumulative total only appears once there's a previous round in it. */}
            <span className="rank-body">
              <span className="rank-name">
                <span className="standings-player-wrap">
                  <Avatar
                    archetypeId={getAvatarForPlayer(row.playerId, row.nickname, row.playerId === meId)}
                    mood={getMood({ pnl: row.roundScore, wasLie: suspects[row.playerId] === "SUS" })}
                    size={22}
                  />
                  <span>{row.nickname}</span>
                </span>
                {suspects[row.playerId] === "TRUSTED" && (
                  <span className="badge-suspect badge-trust">TRUST</span>
                )}
                {suspects[row.playerId] === "SUS" && (
                  <span className="badge-suspect badge-sus">SUS</span>
                )}
                {row.bot && <span className="tag tag-bot">BOT</span>}
                {row.left && <span className="tag muted">left</span>}
              </span>
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
