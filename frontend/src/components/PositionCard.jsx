import { usePrice } from "../state/MatchProvider";
import { price as fmtPrice, toneOf } from "../lib/format";
import { unrealisedPnl } from "../lib/pnl";
import LivePnl from "./LivePnl";

/**
 * Your open position, on the same clock as the chart.
 *
 * Its own component for the same reason LivePnl and FillEstimate are: the deck around it
 * owns the leverage and size sliders, and subscribing to the price from there would
 * re-render a range input ten times a second while a thumb is on it. Nothing here is a
 * slider, so this is free to move at the price's rate.
 *
 * The tint is the point of the file. Until now this card looked the same whether the
 * position was forty percent up or one tick from the wall, so the only way to know was to
 * be watching the chart — which is exactly what a player cannot do while reading the wire,
 * or on a phone where the chart is a tab away.
 */
export default function PositionCard({ position, onClose, disabled }) {
  const { tick } = usePrice();
  const price = tick?.price;

  const pnl = price != null ? unrealisedPnl(position, price) : (position.unrealisedPnl ?? 0);

  // A position sitting on its own entry price is not winning, and a card that greeted you
  // green would be the same false confidence the cross-check used to hand out.
  const deadband = Math.abs(position.margin ?? 0) * 0.01;
  const tone = toneOf(Math.abs(pnl) < deadband ? 0 : pnl);

  // What is left of the entry-to-liquidation distance: 1 at the entry price, 0 at the wall.
  const span = Math.abs(position.entryPrice - position.liquidationPrice);
  const room =
    price != null && span > 0
      ? Math.min(
          1,
          Math.max(
            0,
            (position.side === "LONG"
              ? price - position.liquidationPrice
              : position.liquidationPrice - price) / span,
          ),
        )
      : 1;
  const nearLiq = room <= 0.25;

  return (
    <div className="deck deck-open">
      <div className={`deck-open-header tone-${tone}${nearLiq ? " is-near-liq" : ""}`}>
        <div className="deck-open-info">
          <span className="eyebrow">Your position</span>
          <span className="display deck-open-side">
            <span className={position.side === "LONG" ? "pump" : "dump"}>
              {position.leverage}x {position.side}
            </span>
          </span>
          <span className="mono muted">
            in at {fmtPrice(position.entryPrice)} ·{" "}
            <span className={nearLiq ? "dump" : undefined}>
              wiped out at {fmtPrice(position.liquidationPrice)}
            </span>
          </span>
        </div>

        <div className="deck-open-pnl">
          <span className="eyebrow">Unrealised</span>
          <LivePnl position={position} />
        </div>
      </div>

      <button
        className="btn btn-big btn-scream deck-close"
        onClick={onClose}
        disabled={disabled}
      >
        Close Position <kbd className="keycap">Space</kbd>
      </button>
    </div>
  );
}
