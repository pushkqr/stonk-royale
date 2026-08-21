package com.pushkqr.springBackend.game.model;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The create endpoint is public and unauthenticated, so these bounds are the only thing
 * standing between a crafted request and a match the server has to carry for hours.
 */
class MatchConfigTest {

    private MatchConfig with(int rounds, int roundSeconds, int intermission, double cash, int players) {
        return new MatchConfig(rounds, roundSeconds, intermission, cash, players);
    }

    @Test
    void standardIsTheIntendedExperience() {
        MatchConfig standard = MatchConfig.standard();

        assertEquals(5, standard.rounds());
        assertEquals(90, standard.roundSeconds());
        assertEquals(25, standard.intermissionSeconds());
        assertEquals(10_000, standard.startingCash());
        assertEquals(12, standard.maxPlayers());
    }

    @Test
    void estimatedLengthCountsIntermissions() {
        // 5 rounds of 90s plus 5 intermissions of 25s.
        assertEquals((90 + 25) * 5 * 1000L, MatchConfig.standard().estimatedMillis());
    }

    @Test
    void roundsCannotExceedTheAssetCatalogue() {
        // A match never repeats an asset, so it cannot outlast the catalogue.
        assertDoesNotThrow(() -> with(AssetCatalog.size(), 90, 15, 10_000, 12));
        assertThrows(IllegalArgumentException.class, () -> with(AssetCatalog.size() + 1, 90, 15, 10_000, 12));
        assertThrows(IllegalArgumentException.class, () -> with(0, 90, 15, 10_000, 12));
    }

    @Test
    void roundLengthIsBoundedAtBothEnds() {
        assertDoesNotThrow(() -> with(5, MatchConfig.MIN_ROUND_SECONDS, 15, 10_000, 12));
        assertDoesNotThrow(() -> with(5, MatchConfig.MAX_ROUND_SECONDS, 15, 10_000, 12));
        assertThrows(IllegalArgumentException.class, () -> with(5, MatchConfig.MIN_ROUND_SECONDS - 1, 15, 10_000, 12));
        assertThrows(IllegalArgumentException.class, () -> with(5, MatchConfig.MAX_ROUND_SECONDS + 1, 15, 10_000, 12));
    }

    @Test
    void playerCountIsBoundedAtBothEnds() {
        assertDoesNotThrow(() -> with(5, 90, 15, 10_000, MatchConfig.MIN_PLAYERS));
        assertDoesNotThrow(() -> with(5, 90, 15, 10_000, MatchConfig.MAX_PLAYERS));
        assertThrows(IllegalArgumentException.class, () -> with(5, 90, 15, 10_000, MatchConfig.MIN_PLAYERS - 1));
        assertThrows(IllegalArgumentException.class, () -> with(5, 90, 15, 10_000, MatchConfig.MAX_PLAYERS + 1));
    }

    @Test
    void startingCashIsBoundedAtBothEnds() {
        assertDoesNotThrow(() -> with(5, 90, 15, MatchConfig.MIN_STARTING_CASH, 12));
        assertDoesNotThrow(() -> with(5, 90, 15, MatchConfig.MAX_STARTING_CASH, 12));
        assertThrows(IllegalArgumentException.class, () -> with(5, 90, 15, 0, 12));
        assertThrows(IllegalArgumentException.class, () -> with(5, 90, 15, MatchConfig.MAX_STARTING_CASH + 1, 12));
    }

    @Test
    void intermissionIsBoundedAtBothEnds() {
        assertDoesNotThrow(() -> with(5, 90, MatchConfig.MIN_INTERMISSION_SECONDS, 10_000, 12));
        assertDoesNotThrow(() -> with(5, 90, MatchConfig.MAX_INTERMISSION_SECONDS, 10_000, 12));
        assertThrows(IllegalArgumentException.class, () -> with(5, 90, 0, 10_000, 12));
        assertThrows(IllegalArgumentException.class, () -> with(5, 90, MatchConfig.MAX_INTERMISSION_SECONDS + 1, 10_000, 12));
    }

    @Test
    void anIntermissionInsideTheBoundsIsAccepted() {
        assertDoesNotThrow(() -> with(5, 90, 40, 10_000, 12));
        assertEquals(40, with(5, 90, 40, 10_000, 12).intermissionSeconds());
    }

    /**
     * Starting cash is cosmetic: scoring is a percentage of it, so the same trades score
     * identically whatever the host picks. Worth pinning so it stays that way.
     */
    @Test
    void startingCashDoesNotAffectScoring() {
        PlayerRound modest = new PlayerRound(1_000);
        PlayerRound silly = new PlayerRound(1_000_000);

        modest.open(Side.LONG, 0.5, 4, 100, 0);
        silly.open(Side.LONG, 0.5, 4, 100, 0);

        assertEquals(modest.scoreAt(110), silly.scoreAt(110), 1e-9);
    }

    @Test
    void volatilityMultiplierIsBoundedAtBothEnds() {
        assertDoesNotThrow(() -> new MatchConfig(5, 90, 15, 10_000, 12, MatchConfig.MIN_VOLATILITY));
        assertDoesNotThrow(() -> new MatchConfig(5, 90, 15, 10_000, 12, MatchConfig.MAX_VOLATILITY));
        assertThrows(IllegalArgumentException.class,
                () -> new MatchConfig(5, 90, 15, 10_000, 12, MatchConfig.MIN_VOLATILITY - 0.1));
        assertThrows(IllegalArgumentException.class,
                () -> new MatchConfig(5, 90, 15, 10_000, 12, MatchConfig.MAX_VOLATILITY + 0.1));
    }

    @Test
    void marketImpactMultiplierIsBoundedAtBothEnds() {
        assertDoesNotThrow(() -> new MatchConfig(5, 90, 15, 10_000, 12, 1.0, MatchConfig.MIN_MARKET_IMPACT));
        assertDoesNotThrow(() -> new MatchConfig(5, 90, 15, 10_000, 12, 1.0, MatchConfig.MAX_MARKET_IMPACT));
        assertThrows(IllegalArgumentException.class,
                () -> new MatchConfig(5, 90, 15, 10_000, 12, 1.0, MatchConfig.MIN_MARKET_IMPACT - 0.1));
        assertThrows(IllegalArgumentException.class,
                () -> new MatchConfig(5, 90, 15, 10_000, 12, 1.0, MatchConfig.MAX_MARKET_IMPACT + 0.1));
    }

    /**
     * The generated path has to cover the whole round, at every legal round length.
     *
     * PricePath indexes by {@code elapsed / stepMillis} and clamps past its end, so a path
     * that runs short does not fail — it silently holds the last price for the remainder of
     * the round. This was one nominal-rate-versus-real-step mistake away from being real:
     * {@code roundSeconds * 30 + 1} points at a 33ms step covers 89.1s of a 90s round, which
     * would have flatlined the last nine hundred milliseconds of every round, the stretch
     * players are most often trying to close in.
     */
    @Test
    void thePricePathAlwaysReachesTheEndOfTheRound() {
        for (int seconds = MatchConfig.MIN_ROUND_SECONDS; seconds <= MatchConfig.MAX_ROUND_SECONDS; seconds++) {
            MatchConfig config = new MatchConfig(1, seconds, 15, 10_000, 12);
            long covered = (long) (config.priceSteps() - 1) * MatchConfig.STEP_MILLIS;

            assertTrue(covered >= config.roundMillis(),
                    "roundSeconds=" + seconds + " path covers " + covered
                            + "ms of a " + config.roundMillis() + "ms round");
        }
    }
}
