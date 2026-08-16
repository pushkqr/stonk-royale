package com.pushkqr.springBackend.game.sim;

/**
 * The hidden price behaviour driving a single round.
 *
 * Drift and volatility are expressed over a whole round rather than annualised, so the
 * numbers read directly as "expected move" and "typical swing" for one 90-second round.
 */
public enum Regime {
    PUMP(0.35, 0.15, null),
    DUMP(-0.35, 0.15, null),
    CHOP(0.0, 0.25, null),
    RUG(0.22, 0.12, new Shock(0.60, -0.50)),
    SQUEEZE(-0.18, 0.12, new Shock(0.60, 0.50));

    /**
     * A violent move spliced into the path. {@code magnitude} is the total multiplicative
     * change, ramped in over {@link #SHOCK_DURATION} of the round starting at
     * {@code startFraction}.
     */
    public record Shock(double startFraction, double magnitude) {
    }

    /** Fraction of a round a shock takes to play out — long enough to react to. */
    public static final double SHOCK_DURATION = 0.06;

    private final double drift;
    private final double volatility;
    private final Shock shock;

    Regime(double drift, double volatility, Shock shock) {
        this.drift = drift;
        this.volatility = volatility;
        this.shock = shock;
    }

    public double drift() {
        return drift;
    }

    public double volatility() {
        return volatility;
    }

    /** The spliced-in shock, or null for regimes that are pure drift and noise. */
    public Shock shock() {
        return shock;
    }
}
