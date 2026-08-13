package com.pushkqr.springBackend.game.model;

/**
 * One player's state for one round.
 *
 * Cash is held whole and PnL is tracked against the open position, so equity is always
 * {@code cash + unrealised}. Margin is a sizing input, not a balance that moves around —
 * which keeps the accounting hard to get wrong.
 *
 * A liquidated player keeps whatever cash survived and may open again. There is no
 * elimination inside a round; sitting on your hands for 80 seconds is the one outcome
 * the design will not produce.
 */
public final class PlayerRound {

    private final double startingCash;
    private double cash;
    private Position position;
    private int liquidations;

    public PlayerRound(double startingCash) {
        if (startingCash <= 0) {
            throw new IllegalArgumentException("startingCash must be positive");
        }
        this.startingCash = startingCash;
        this.cash = startingCash;
    }

    /**
     * @param sizeFraction share of remaining cash to post as margin, in (0, 1]
     */
    public Position open(Side side, double sizeFraction, int leverage, double price, long atMillis) {
        if (position != null) {
            throw new IllegalStateException("A position is already open");
        }
        if (sizeFraction <= 0 || sizeFraction > 1) {
            throw new IllegalArgumentException("sizeFraction must be in (0, 1]");
        }
        if (cash <= 0) {
            throw new IllegalStateException("No cash left to trade");
        }
        position = new Position(side, cash * sizeFraction, leverage, price, atMillis);
        return position;
    }

    /** Closes at the given price and books the PnL. Returns the realised PnL. */
    public double close(double price) {
        if (position == null) {
            throw new IllegalStateException("No position is open");
        }
        double pnl = position.unrealisedPnl(price);
        cash += pnl;
        position = null;
        return pnl;
    }

    /**
     * Force-closes if the position has breached maintenance margin. Settles at exactly
     * the maintenance loss rather than the tick's price, so the damage matches the
     * liquidation price shown to the player.
     *
     * @return true if a liquidation happened on this call
     */
    public boolean liquidateIfBreached(double price) {
        if (position == null || !position.isLiquidatedAt(price)) {
            return false;
        }
        cash -= Position.MAINTENANCE * position.margin();
        position = null;
        liquidations++;
        return true;
    }

    public double equity(double price) {
        return position == null ? cash : cash + position.unrealisedPnl(price);
    }

    /** Round score, as a percentage of the cash this round started with. */
    public double scoreAt(double price) {
        return (equity(price) / startingCash - 1) * 100;
    }

    public double startingCash() {
        return startingCash;
    }

    public double cash() {
        return cash;
    }

    public Position position() {
        return position;
    }

    public boolean hasPosition() {
        return position != null;
    }

    public int liquidations() {
        return liquidations;
    }
}
