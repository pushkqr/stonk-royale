package com.pushkqr.springBackend.game.model;

public record MatchConfig(int rounds, int roundSeconds, int intermissionSeconds, double startingCash, int maxPlayers) {

    /** Price ticks per second. 10 is smooth on a chart without flooding the socket. */
    public static final int TICKS_PER_SECOND = 10;

    public static final long STEP_MILLIS = 1000 / TICKS_PER_SECOND;

    public MatchConfig {
        if (rounds < 1 || rounds > AssetCatalog.size()) {
            throw new IllegalArgumentException("rounds must be between 1 and " + AssetCatalog.size());
        }
        if (roundSeconds < 10) {
            throw new IllegalArgumentException("roundSeconds must be at least 10");
        }
        if (intermissionSeconds < 1) {
            throw new IllegalArgumentException("intermissionSeconds must be at least 1");
        }
        if (startingCash <= 0) {
            throw new IllegalArgumentException("startingCash must be positive");
        }
        if (maxPlayers < 2) {
            throw new IllegalArgumentException("maxPlayers must be at least 2");
        }
    }

    public static MatchConfig standard() {
        return new MatchConfig(5, 90, 15, 10_000, 12);
    }

    public long roundMillis() {
        return roundSeconds * 1000L;
    }

    public long intermissionMillis() {
        return intermissionSeconds * 1000L;
    }

    public int priceSteps() {
        return roundSeconds * TICKS_PER_SECOND + 1;
    }
}
