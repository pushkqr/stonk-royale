package com.pushkqr.springBackend.game.model;

/**
 * One open leveraged position. Immutable — opening and closing replaces it rather than
 * mutating, so a position's entry terms can never drift after the fact.
 */
public record Position(Side side, double margin, int leverage, double entryPrice, long openedAtMillis) {

    /** Share of posted margin a position may lose before it is force-closed. */
    public static final double MAINTENANCE = 0.90;

    public static final int MAX_LEVERAGE = 10;

    public Position {
        if (margin <= 0) {
            throw new IllegalArgumentException("margin must be positive");
        }
        if (leverage < 1 || leverage > MAX_LEVERAGE) {
            throw new IllegalArgumentException("leverage must be between 1 and " + MAX_LEVERAGE);
        }
        if (entryPrice <= 0) {
            throw new IllegalArgumentException("entryPrice must be positive");
        }
    }

    public double notional() {
        return margin * leverage;
    }

    public double units() {
        return notional() / entryPrice;
    }

    public double unrealisedPnl(double price) {
        return units() * (price - entryPrice) * side.direction();
    }

    /**
     * The price at which this position is wiped out. Surfaced to the player so the risk
     * is visible rather than a surprise.
     */
    public double liquidationPrice() {
        return entryPrice * (1 - side.direction() * MAINTENANCE / leverage);
    }

    public boolean isLiquidatedAt(double price) {
        return unrealisedPnl(price) <= -MAINTENANCE * margin;
    }
}
