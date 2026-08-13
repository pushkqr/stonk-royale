package com.pushkqr.springBackend.game.info;

import com.pushkqr.springBackend.game.sim.Regime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

class InformationScripterTest {

    private static final long ROUND_MILLIS = 90_000;
    private static final String TICKER = "SOLARIS";
    private static final int SAMPLES = 5_000;

    private final InformationScripter scripter = new InformationScripter();

    @Test
    void aboutFortyPercentOfRumorsAreTrue() {
        Random random = new Random(1);
        long truthful = 0;
        for (int i = 0; i < SAMPLES; i++) {
            if (scripter.rumorFor(Regime.PUMP, TICKER, random).truthful()) {
                truthful++;
            }
        }

        double rate = (double) truthful / SAMPLES;
        assertTrue(rate > 0.36 && rate < 0.44, "true-rumor rate was " + rate);
    }

    @ParameterizedTest
    @EnumSource(Regime.class)
    void truthfulRumorsNameTheRealRegimeAndLiesDoNot(Regime actual) {
        Random random = new Random(2);
        for (int i = 0; i < 500; i++) {
            Rumor rumor = scripter.rumorFor(actual, TICKER, random);
            assertEquals(rumor.truthful(), rumor.claimedRegime() == actual,
                    "truthfulness must match whether the claim is the real regime");
        }
    }

    @Test
    void rumorTextMentionsTheTicker() {
        Rumor rumor = scripter.rumorFor(Regime.RUG, TICKER, new Random(3));
        assertTrue(rumor.text().contains(TICKER), "rumor was: " + rumor.text());
    }

    /**
     * The core requirement of the mechanic: a player holding a rumor must not be able to
     * tell truth from lie by its wording. Every phrasing must be reachable both ways.
     */
    @Test
    void identicalWordingIsUsedForTruthsAndLies() {
        Random random = new Random(4);
        Set<String> truthfulText = new java.util.HashSet<>();
        Set<String> lyingText = new java.util.HashSet<>();

        for (int i = 0; i < SAMPLES; i++) {
            // A PUMP rumor is truthful in a PUMP round and a lie in a DUMP round.
            Rumor asTruth = scripter.rumorFor(Regime.PUMP, TICKER, random);
            if (asTruth.claimedRegime() == Regime.PUMP) {
                truthfulText.add(asTruth.text());
            }
            Rumor asLie = scripter.rumorFor(Regime.DUMP, TICKER, random);
            if (asLie.claimedRegime() == Regime.PUMP) {
                lyingText.add(asLie.text());
            }
        }

        assertFalse(truthfulText.isEmpty());
        assertEquals(truthfulText, lyingText, "wording must not leak whether a rumor is true");
    }

    @ParameterizedTest
    @EnumSource(Regime.class)
    void everyRoundGetsExactlyOneTruthAndOneLie(Regime actual) {
        List<MarketEvent> events = scripter.eventsFor(actual, TICKER, ROUND_MILLIS, new Random(5));

        assertEquals(2, events.size());
        assertEquals(1, events.stream().filter(MarketEvent::truthful).count());
        assertEquals(1, events.stream().filter(e -> !e.truthful()).count());
    }

    @ParameterizedTest
    @EnumSource(Regime.class)
    void eventsAreOrderedAndLandInsideTheRound(Regime actual) {
        for (int seed = 0; seed < 200; seed++) {
            List<MarketEvent> events = scripter.eventsFor(actual, TICKER, ROUND_MILLIS, new Random(seed));

            assertTrue(events.get(0).atMillis() <= events.get(1).atMillis(), "events must be time-ordered");
            for (MarketEvent event : events) {
                assertTrue(event.atMillis() > 0 && event.atMillis() < ROUND_MILLIS,
                        actual + " event landed at " + event.atMillis());
            }
        }
    }

    @Test
    void shockWarningsFireBeforeTheShockTheyWarnAbout() {
        for (Regime shocked : List.of(Regime.RUG, Regime.SQUEEZE)) {
            long shockStart = (long) (ROUND_MILLIS * shocked.shock().startFraction());

            for (int seed = 0; seed < 200; seed++) {
                MarketEvent warning = scripter.eventsFor(shocked, TICKER, ROUND_MILLIS, new Random(seed))
                        .stream().filter(MarketEvent::truthful).findFirst().orElseThrow();

                long lead = shockStart - warning.atMillis();
                assertTrue(lead >= 2_000 && lead <= 4_000,
                        shocked + " warning lead was " + lead + "ms — players need a reaction beat");
            }
        }
    }

    /**
     * If truthful headlines only ever appeared just before a shock, their timing alone
     * would give the round away. Lies have to be able to land in the same window.
     */
    @Test
    void liesCanLandInTheSameWindowAsShockWarnings() {
        long shockStart = (long) (ROUND_MILLIS * Regime.RUG.shock().startFraction());

        boolean lieInWarningWindow = false;
        for (int seed = 0; seed < 500 && !lieInWarningWindow; seed++) {
            lieInWarningWindow = scripter.eventsFor(Regime.RUG, TICKER, ROUND_MILLIS, new Random(seed))
                    .stream()
                    .filter(e -> !e.truthful())
                    .anyMatch(e -> {
                        long lead = shockStart - e.atMillis();
                        return lead >= 2_000 && lead <= 4_000;
                    });
        }

        assertTrue(lieInWarningWindow, "timing alone must not identify the truthful headline");
    }

    @Test
    void headlinesClaimingEachRegimeAreAllReachable() {
        Random random = new Random(6);
        Set<Regime> claimed = java.util.stream.IntStream.range(0, SAMPLES)
                .boxed()
                .flatMap(i -> scripter.eventsFor(Regime.CHOP, TICKER, ROUND_MILLIS, random).stream())
                .map(MarketEvent::claimedRegime)
                .collect(Collectors.toSet());

        assertEquals(Set.of(Regime.values()), claimed);
    }
}
