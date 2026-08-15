import { memo } from "react";
import { usePrice } from "../state/MatchProvider";
import { pct, price as fmtPrice, toneOf } from "../lib/format";

function LiveFloorPrice({ startPrice }) {
  const { tick } = usePrice();
  const live = tick?.price ?? startPrice ?? 0;
  const move = startPrice ? ((live - startPrice) / startPrice) * 100 : 0;

  return (
    <div className="floor-price">
      <span className={`display price-now ${move >= 0 ? "pump" : "dump"}`}>
        {fmtPrice(live)}
      </span>
      <span className={`mono price-move ${toneOf(move)}`}>{pct(move)}</span>
    </div>
  );
}

export default memo(LiveFloorPrice);
