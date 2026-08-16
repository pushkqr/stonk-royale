package com.pushkqr.springBackend.game.sim;

/**
 * How much the room's own trading pushes the price away from the seeded path, and how fast
 * that push fades.
 *
 * The base path from {@link MarketSimulator} is the tide; this is the chop players make on
 * top of it. It never touches the path itself, so a regime that was seeded to rug still
 * rugs, and a tip that was dealt true stays true — only the ride there gets rougher.
 */
public final class MarketImpact {

    /**
     * How far a trade of exactly {@code referenceNotional} pushes the price at 1.0x impact.
     *
     * Public because the client shows players what their order will fill at, and a second
     * copy of this number in the frontend would drift the first time it is retuned — which
     * has already happened once.
     */
    public static final double IMPACT_PER_TRADE = 0.015;

    /** How fast a kick fades: within one time constant it is down to ~37% of its peak. */
    private static final double DECAY_TAU_SECONDS = 4.0;

    /** Base 4% impact cap for 1.0x multiplier. */
    private static final double BASE_MAX_IMPACT = 0.04;

    private final double impactMultiplier;
    private final double maxImpact;
    private double value;
    private long lastMillis;

    public MarketImpact(long startMillis, double impactMultiplier) {
        this.lastMillis = startMillis;
        this.impactMultiplier = impactMultiplier;
        this.maxImpact = Math.min(0.12, BASE_MAX_IMPACT * Math.max(1.0, impactMultiplier * 0.75));
    }

    public MarketImpact(long startMillis) {
        this(startMillis, 1.0);
    }

    /**
     * The impact at {@code now}, decayed from whatever it was after the last recorded
     * trade. Pure: exponential decay composes, so this needs no per-tick bookkeeping to
     * stay correct between kicks — reading it twice with no {@link #record} between gives
     * the same answer either time, computed fresh from the last recorded kick.
     */
    public double valueAt(long now) {
        double elapsedSeconds = Math.max(0, now - lastMillis) / 1000.0;
        return value * Math.exp(-elapsedSeconds / DECAY_TAU_SECONDS);
    }

    /**
     * Folds one trade's push into the running impact.
     *
     * @param notional          the trade's size — a {@code Position}'s {@code margin * leverage}
     * @param direction         +1 for buying pressure (opening long, closing short), -1 for
     *                          selling pressure (opening short, closing long)
     * @param referenceNotional one player's maximum possible position. Deliberately not
     *                          scaled by room size or player count — a crowd is forceful
     *                          because it is a crowd, not because the reference shrinks.
     */
    public void record(double notional, int direction, double referenceNotional, long now) {
        double kick = (IMPACT_PER_TRADE * impactMultiplier) * (notional * direction) / referenceNotional;
        value = clamp(valueAt(now) + kick);
        lastMillis = now;
    }

    private double clamp(double v) {
        return Math.max(-maxImpact, Math.min(maxImpact, v));
    }

    public double impactMultiplier() {
        return impactMultiplier;
    }

    public double maxImpact() {
        return maxImpact;
    }
}
