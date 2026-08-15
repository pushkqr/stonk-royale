import { usePrice } from "../state/MatchProvider";
import { signedMoney, toneOf } from "../lib/format";
import { unrealisedPnl } from "../lib/pnl";

/**
 * Your open position's PnL, on the same clock as the chart.
 *
 * Its own component so the deck around it can stay memoised: the deck owns the leverage and
 * size sliders, and re-rendering a range input ten times a second while a thumb is on it is
 * how you get jitter on a touch screen. A memoised parent does not stop this from updating,
 * because the subscription is here.
 */
export default function LivePnl({ position }) {
  const { tick } = usePrice();
  const pnl = unrealisedPnl(position, tick?.price);

  return (
    <span className={`display deck-pnl ${toneOf(pnl)}`}>{signedMoney(pnl)}</span>
  );
}
