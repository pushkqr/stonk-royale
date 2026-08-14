package com.pushkqr.springBackend.game.model;

/**
 * The settings a host can pick, and the bounds they have to sit inside.
 *
 * Both ends of every range are enforced here rather than in the UI, because the create
 * endpoint is public: without an upper bound a request could ask for a 24-hour round or a
 * hundred-thousand-player room and the server would happily allocate it.
 */
public record MatchConfig(int rounds, int roundSeconds, int intermissionSeconds, double startingCash, int maxPlayers) {

    /** Price ticks per second. 10 is smooth on a chart without flooding the socket. */
    public static final int TICKS_PER_SECOND = 10;

    public static final long STEP_MILLIS = 1000 / TICKS_PER_SECOND;

    public static final int MIN_ROUND_SECONDS = 10;
    public static final int MAX_ROUND_SECONDS = 300;
    public static final int MIN_INTERMISSION_SECONDS = 1;
    public static final int MAX_INTERMISSION_SECONDS = 60;
    public static final double MIN_STARTING_CASH = 100;
    public static final double MAX_STARTING_CASH = 10_000_000;
    public static final int MIN_PLAYERS = 2;

    /** Above a dozen the chat is unreadable, which is where the game actually happens. */
    public static final int MAX_PLAYERS = 12;

    public MatchConfig {
        // Rounds are capped by the catalogue because a match never repeats an asset.
        require(rounds >= 1 && rounds <= AssetCatalog.size(),
                "rounds must be between 1 and " + AssetCatalog.size());
        require(roundSeconds >= MIN_ROUND_SECONDS && roundSeconds <= MAX_ROUND_SECONDS,
                "roundSeconds must be between " + MIN_ROUND_SECONDS + " and " + MAX_ROUND_SECONDS);
        require(intermissionSeconds >= MIN_INTERMISSION_SECONDS && intermissionSeconds <= MAX_INTERMISSION_SECONDS,
                "intermissionSeconds must be between " + MIN_INTERMISSION_SECONDS + " and " + MAX_INTERMISSION_SECONDS);
        require(startingCash >= MIN_STARTING_CASH && startingCash <= MAX_STARTING_CASH,
                "startingCash must be between " + (long) MIN_STARTING_CASH + " and " + (long) MAX_STARTING_CASH);
        require(maxPlayers >= MIN_PLAYERS && maxPlayers <= MAX_PLAYERS,
                "maxPlayers must be between " + MIN_PLAYERS + " and " + MAX_PLAYERS);
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new IllegalArgumentException(message);
        }
    }

    public static MatchConfig standard() {
        return new MatchConfig(5, 90, 25, 10_000, MAX_PLAYERS);
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

    /** What the lobby advertises as the match length, intermissions included. */
    public long estimatedMillis() {
        return rounds * (roundMillis() + intermissionMillis());
    }
}
