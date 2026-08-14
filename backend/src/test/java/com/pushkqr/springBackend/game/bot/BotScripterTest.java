package com.pushkqr.springBackend.game.bot;

import com.pushkqr.springBackend.game.info.Rumor;
import com.pushkqr.springBackend.game.sim.Regime;
import org.junit.jupiter.api.Test;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

class BotScripterTest {

    private static final List<String> BOTS = List.of("bot:1", "bot:2", "bot:3");

    private Map<String, Rumor> rumors(Regime claimed) {
        Map<String, Rumor> rumors = new LinkedHashMap<>();
        for (String id : BOTS) {
            rumors.put(id, new Rumor("word is " + claimed, claimed, false));
        }
        return rumors;
    }

    private BotScript scriptFor(Regime regime, long seed) {
        return new BotScripter().script(
                regime, 60_000, 20_000, BOTS, rumors(Regime.PUMP), new Random(seed));
    }

    @Test
    void theSameSeedProducesTheSameScript() {
        assertThat(scriptFor(Regime.PUMP, 42)).isEqualTo(scriptFor(Regime.PUMP, 42));
    }

    @Test
    void differentSeedsProduceDifferentScripts() {
        assertThat(scriptFor(Regime.PUMP, 1)).isNotEqualTo(scriptFor(Regime.PUMP, 2));
    }

    @Test
    void everyBotGetsAnOpeningTrade() {
        BotScript script = scriptFor(Regime.PUMP, 7);
        assertThat(script.actions())
                .filteredOn(BotAction.Open.class::isInstance)
                .extracting(BotAction::botId)
                .containsAll(BOTS);
    }

    @Test
    void bothListsComeOutSortedByTime() {
        BotScript script = scriptFor(Regime.RUG, 3);
        assertThat(script.actions()).isSortedAccordingTo(
                Comparator.comparingLong(BotAction::atMillis));
        assertThat(script.chatter()).isSortedAccordingTo(
                Comparator.comparingLong(BotAction::atMillis));
    }

    @Test
    void everyScheduledActionLandsInsideItsPhase() {
        for (Regime regime : Regime.values()) {
            BotScript script = scriptFor(regime, regime.ordinal());
            assertThat(script.actions()).allSatisfy(action ->
                    assertThat(action.atMillis()).isBetween(0L, 60_000L));
            assertThat(script.chatter()).allSatisfy(say ->
                    assertThat(say.atMillis()).isBetween(0L, 20_000L));
        }
    }

    @Test
    void exactlyOneBotLiesAboutItsTipEachRound() {
        // Every bot here holds a tip claiming PUMP, so any claim that is not PUMP is a lie.
        for (Regime regime : Regime.values()) {
            BotScript script = scriptFor(regime, regime.ordinal() + 100);
            long liars = script.chatter().stream()
                    .filter(say -> say.claim() != null && say.claim() != Regime.PUMP)
                    .count();
            assertThat(liars).as("liars in a %s round", regime).isEqualTo(1);
        }
    }

    @Test
    void everyBotGoesOnRecordDuringTheIntermission() {
        BotScript script = scriptFor(Regime.DUMP, 9);
        assertThat(script.chatter())
                .extracting(BotAction::botId)
                .containsExactlyInAnyOrderElementsOf(BOTS);
        assertThat(script.chatter()).allSatisfy(say ->
                assertThat(say.claim()).isNotNull());
    }

    @Test
    void aShockRegimeKeepsTheSharpBotOutUntilTheShockStarts() {
        // A RUG drifts up 20% before it collapses. A short opened early is liquidated by the
        // drift long before the crash it correctly called.
        BotScript script = scriptFor(Regime.RUG, 11);
        long shockStart = (long) (60_000 * Regime.RUG.shock().startFraction());

        // Identified by leverage, not by side: CHOPPER also takes the paying side, earlier
        // and at 2x, so filtering on SHORT alone would find the wrong bot.
        BotAction.Open sharpOpen = script.actions().stream()
                .filter(BotAction.Open.class::isInstance)
                .map(BotAction.Open.class::cast)
                .filter(open -> open.leverage() == 4)
                .findFirst()
                .orElseThrow();

        assertThat(sharpOpen.atMillis()).isGreaterThanOrEqualTo(shockStart);
    }
}
