/**
 * The same numbers the server computes, rebuilt here against the live price.
 *
 * The board arrives twice a second while the chart moves ten times a second, so anything
 * read straight off the board is up to half a second behind the line it is being read
 * against. Everything here is display only — the server remains the authority on what a
 * position is actually worth when it settles.
 */

/**
 * What an open position is worth at this price.
 *
 * The price is clamped to the liquidation price first. At exactly that price the loss is the
 * maintenance margin by construction, so the clamp puts a floor on the number at the same
 * place the server does. Without it, a tick that has blown through the liquidation price but
 * has not yet been processed would flash a loss larger than the stake — the position is
 * already gone at that point, the server just has not said so yet.
 */
export function unrealisedPnl(position, price) {
  if (!position || !price) return 0;

  const direction = position.side === "LONG" ? 1 : -1;
  const floored =
    direction === 1
      ? Math.max(price, position.liquidationPrice)
      : Math.min(price, position.liquidationPrice);

  const units = (position.margin * position.leverage) / position.entryPrice;
  return units * (floored - position.entryPrice) * direction;
}

/** Cash plus whatever the open position is currently worth. */
export function liveEquity(row, price) {
  if (!row) return 0;
  return row.cash + unrealisedPnl(row.position, price);
}

/** The round's score as a percentage of the stack it started with. */
export function liveRoundScore(row, price, startingCash) {
  if (!row || !startingCash) return 0;
  return (liveEquity(row, price) / startingCash - 1) * 100;
}
