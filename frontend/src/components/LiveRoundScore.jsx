import { memo } from "react";
import { usePrice } from "../state/MatchProvider";
import { liveRoundScore } from "../lib/pnl";
import { pct, toneOf } from "../lib/format";

function LiveRoundScore({ me, startingCash, startPrice }) {
  const { tick } = usePrice();
  const live = tick?.price ?? startPrice ?? 0;
  const myScore = me?.inRound ? liveRoundScore(me, live, startingCash ?? 0) : 0;

  return (
    <div className="strip-me">
      <span className="eyebrow">This round</span>
      <span className={`display strip-score ${toneOf(myScore)}`}>
        {pct(myScore)}
      </span>
    </div>
  );
}

export default memo(LiveRoundScore);
