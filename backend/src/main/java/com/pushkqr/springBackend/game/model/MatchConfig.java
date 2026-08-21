package com.pushkqr.springBackend.game.model;

/**
 * The settings a host can pick, and the bounds they have to sit inside.
 *
 * Both ends of every range are enforced here rather than in the UI, because the create
 * endpoint is public: without an upper bound a request could ask for a 24-hour round or a
 * hundred-thousand-player room and the server would happily allocate it.
 */
public record MatchConfig(
        int rounds,
        int roundSeconds,
        int intermissionSeconds,
        double startingCash,
        int maxPlayers,
        double volatilityMultiplier,
        double marketImpactMultiplier,
        Modifier modifier) {

    /**
     * Price ticks per second, which is also the rate prices go out on the wire.
     *
     * This was 10 for a long time. A chart cannot draw a pointer that sits exactly on the
     * newest price and still move smoothly — the newest price only exists once per tick, so
     * at 10 the pointer would be frozen for 83% of frames on a 60Hz screen. The client
     * therefore renders slightly behind the newest sample and interpolates, and the size of
     * that lag is what a player feels when their entry does not land where they aimed.
     *
     * Raising the rate is what shrinks the lag without giving the smoothness back: measured
     * end to end, 10/sec left the drawn pointer 0.44% of price away from the fill and 30/sec
     * leaves it 0.21%. The engine has room for it — one pass over 150 rooms of 8 players
     * measures 169us against the 33ms budget below.
     */
    public static final int TICKS_PER_SECOND = 30;

    /**
     * Integer division, so this is 33 and not 33.33 — the tick rate is nominal and this is
     * the real one. Everything that has to line up with the clock derives from this constant
     * rather than from the rate, because at rates that do not divide 1000 the two disagree.
     */
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

    public static final double MIN_VOLATILITY = 0.5;
    public static final double MAX_VOLATILITY = 3.0;

    public static final double MIN_MARKET_IMPACT = 0.5;
    public static final double MAX_MARKET_IMPACT = 5.0;

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
        require(volatilityMultiplier >= MIN_VOLATILITY && volatilityMultiplier <= MAX_VOLATILITY,
                "volatilityMultiplier must be between " + MIN_VOLATILITY + " and " + MAX_VOLATILITY);
        require(marketImpactMultiplier >= MIN_MARKET_IMPACT && marketImpactMultiplier <= MAX_MARKET_IMPACT,
                "marketImpactMultiplier must be between " + MIN_MARKET_IMPACT + " and " + MAX_MARKET_IMPACT);
        require(modifier != null, "modifier is required");
    }

    /** Backward-compatible 7-argument constructor defaulting the modifier to none. */
    public MatchConfig(int rounds, int roundSeconds, int intermissionSeconds, double startingCash,
            int maxPlayers, double volatilityMultiplier, double marketImpactMultiplier) {
        this(rounds, roundSeconds, intermissionSeconds, startingCash, maxPlayers,
                volatilityMultiplier, marketImpactMultiplier, Modifier.NONE);
    }

    /** Backward-compatible 6-argument constructor defaulting marketImpactMultiplier to 1.0. */
    public MatchConfig(int rounds, int roundSeconds, int intermissionSeconds, double startingCash, int maxPlayers, double volatilityMultiplier) {
        this(rounds, roundSeconds, intermissionSeconds, startingCash, maxPlayers, volatilityMultiplier, 1.0, Modifier.NONE);
    }

    /** Backward-compatible 5-argument constructor defaulting volatilityMultiplier & marketImpactMultiplier to 1.0. */
    public MatchConfig(int rounds, int roundSeconds, int intermissionSeconds, double startingCash, int maxPlayers) {
        this(rounds, roundSeconds, intermissionSeconds, startingCash, maxPlayers, 1.0, 1.0, Modifier.NONE);
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new IllegalArgumentException(message);
        }
    }

    public static MatchConfig standard() {
        return new MatchConfig(5, 90, 25, 10_000, MAX_PLAYERS, 1.0, 1.0, Modifier.NONE);
    }

    public long roundMillis() {
        return roundSeconds * 1000L;
    }

    public long intermissionMillis() {
        return intermissionSeconds * 1000L;
    }

    /**
     * Enough points that the path covers the whole round.
     *
     * Derived from the real step and not from the nominal rate, because the two only agree
     * when the rate divides 1000. PricePath indexes by {@code elapsed / stepMillis} and
     * clamps past the end, so a path built as {@code roundSeconds * 30 + 1} at a 33ms step
     * covers 89.1 seconds of a 90 second round and the price flatlines for the last 900ms —
     * which is the stretch of a round players are most often trying to close in.
     */
    public int priceSteps() {
        // Rounded up, not down: a truncating divide leaves the path up to one step short of
        // the buzzer, which is the same flatline in miniature.
        return (int) ((roundMillis() + STEP_MILLIS - 1) / STEP_MILLIS) + 1;
    }

    /** What the lobby advertises as the match length, intermissions included. */
    public long estimatedMillis() {
        return (long) rounds * (roundSeconds + intermissionSeconds) * 1000L;
    }
}
