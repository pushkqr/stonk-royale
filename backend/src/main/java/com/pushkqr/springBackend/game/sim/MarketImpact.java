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

    /** A player's largest possible single trade moves price by roughly this much. */
    private static final double IMPACT_PER_TRADE = 0.015;

    /** How fast a kick fades: within one time constant it is down to ~37% of its peak. */
    private static final double DECAY_TAU_SECONDS = 4.0;

    /** However hard the room pushes, the price can never be displaced more than this. */
    private static final double MAX_IMPACT = 0.06;

    private double value;
    private long lastMillis;

    public MarketImpact(long startMillis) {
        this.lastMillis = startMillis;
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
        double kick = IMPACT_PER_TRADE * (notional * direction) / referenceNotional;
        value = clamp(valueAt(now) + kick);
        lastMillis = now;
    }

    private static double clamp(double v) {
        return Math.max(-MAX_IMPACT, Math.min(MAX_IMPACT, v));
    }
}
