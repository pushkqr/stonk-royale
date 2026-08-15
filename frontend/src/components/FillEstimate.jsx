import { usePrice } from "../state/MatchProvider";
import { price as fmtPrice } from "../lib/format";

/**
 * Where an order this size would actually fill.
 *
 * Your own trade moves your own fill — the kick is recorded before the price is read, which
 * is what rules out opening, watching your own push and closing for free. On small orders it
 * is fractions of a percent; at full size and ten times leverage it is the whole 1.5%, which
 * is fifteen percent of the margin gone at the instant of the click. It was invisible until
 * now, so it read as the game cheating rather than as the cost of size.
 *
 * An estimate, not a quote: the price also moves on its own between the render and the fill,
 * and the impact model clamps a total that already includes everyone else's trading.
 */
export default function FillEstimate({ side, notional, impact }) {
  const { tick } = usePrice();
  const price = tick?.price;
  if (!price || !impact?.referenceNotional) return null;

  const direction = side === "LONG" ? 1 : -1;
  const push = (impact.perTrade * notional * direction) / impact.referenceNotional;

  // Hidden from the accessibility tree on purpose. This sits inside the Long and Short
  // buttons, so it would otherwise become part of their accessible name — a name that
  // rewrites ten times a second, on a control someone is in the middle of pressing. The
  // number is a glanceable hint, not information a button needs to announce.
  return (
    <span className="deck-fill mono" aria-hidden="true">
      ≈ {fmtPrice(price * (1 + push))}
    </span>
  );
}
