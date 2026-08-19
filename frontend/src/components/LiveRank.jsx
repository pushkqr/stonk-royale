import { memo } from "react";

/**
 * Where you stand, in the strip, for the whole round.
 *
 * The rail's Standings panel answers this on desktop and sits behind a tab on a phone, so a
 * phone player could watch their own return climb all round without ever learning whether it
 * was winning — in a game scored on where you finish rather than what you made. Leaving the
 * chart to find out, mid-round and leveraged, is the one trade nobody wants to make, which is
 * why the answer has to come to them instead.
 *
 * The place alone, not the gap to the seat above. It answers "am I winning", which is the
 * question, and it fits the two-line shape the strip already uses for the round score. "How
 * hard do I push" is worth less and costs a third line on a bar that has none to give.
 *
 * Rows arrive ordered by equity — MatchBroadcaster sorts them that way and the Standings
 * panel lists them in the same order, so the number here can never disagree with the table it
 * summarises.
 */
function LiveRank({ rows, meId }) {
  // One seat is not a standing, and a room of one is the practice case.
  if (!rows || rows.length < 2) return null;

  const place = rows.findIndex((r) => r.playerId === meId);
  if (place < 0) return null;

  return (
    <div className="strip-rank">
      <span className="eyebrow">Standing</span>
      <span className="display strip-place">
        #{place + 1}
        <span className="strip-place-of"> of {rows.length}</span>
      </span>
    </div>
  );
}

export default memo(LiveRank);
