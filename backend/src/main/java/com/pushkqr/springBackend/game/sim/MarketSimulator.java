package com.pushkqr.springBackend.game.sim;

import java.util.Random;

/**
 * Generates deterministic round price paths.
 *
 * Geometric Brownian motion supplies the texture; the regime supplies drift, volatility
 * and any spliced-in shock. Identical seeds always produce identical paths, so a match
 * can be replayed or rematched on the same market.
 */
public final class MarketSimulator {

    public PricePath generate(double startPrice, Regime regime, int steps, long stepMillis, long seed) {
        if (startPrice <= 0) {
            throw new IllegalArgumentException("startPrice must be positive");
        }
        if (steps < 2) {
            throw new IllegalArgumentException("steps must be at least 2");
        }

        Random random = new Random(seed);
        double dt = 1.0 / (steps - 1);
        double sigma = regime.volatility();
        double drift = (regime.drift() - 0.5 * sigma * sigma) * dt;
        double diffusion = sigma * Math.sqrt(dt);

        double[] prices = new double[steps];
        prices[0] = startPrice;
        for (int i = 1; i < steps; i++) {
            prices[i] = prices[i - 1] * Math.exp(drift + diffusion * random.nextGaussian());
        }

        applyShock(prices, regime);
        return new PricePath(prices, stepMillis);
    }

    /**
     * Ramps the shock in over {@link Regime#SHOCK_DURATION} and holds it for the rest of
     * the round. Multiplying the existing path keeps the GBM texture through the crash
     * instead of flattening it into a straight line.
     */
    private void applyShock(double[] prices, Regime regime) {
        Regime.Shock shock = regime.shock();
        if (shock == null) {
            return;
        }

        int start = (int) (prices.length * shock.startFraction());
        int duration = Math.max(1, (int) (prices.length * Regime.SHOCK_DURATION));

        for (int i = start; i < prices.length; i++) {
            double progress = Math.min(1.0, (double) (i - start) / duration);
            prices[i] *= 1.0 + shock.magnitude() * progress;
        }
    }
}
