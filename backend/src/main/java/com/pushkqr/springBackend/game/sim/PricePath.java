package com.pushkqr.springBackend.game.sim;

/**
 * A fully precomputed price series for one round.
 *
 * The whole path exists before the round starts, so serving the current price is an
 * array lookup rather than a simulation step. That also means the server knows the
 * round's future, which is what the rumor and event layer is built on.
 */
public final class PricePath {

    private final double[] prices;
    private final long stepMillis;

    PricePath(double[] prices, long stepMillis) {
        this.prices = prices;
        this.stepMillis = stepMillis;
    }

    /** Price at a point in the round, clamped to the path at both ends. */
    public double priceAt(long elapsedMillis) {
        long index = elapsedMillis / stepMillis;
        if (index < 0) {
            return prices[0];
        }
        if (index >= prices.length) {
            return prices[prices.length - 1];
        }
        return prices[(int) index];
    }

    public double startPrice() {
        return prices[0];
    }

    public double endPrice() {
        return prices[prices.length - 1];
    }

    public int size() {
        return prices.length;
    }

    public long stepMillis() {
        return stepMillis;
    }

    public double[] toArray() {
        return prices.clone();
    }
}
