package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.model.MatchConfig;
import com.pushkqr.springBackend.game.model.Modifier;
import com.pushkqr.springBackend.game.model.Position;
import com.pushkqr.springBackend.game.model.Side;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The variants a host can pick, and the two things about them that are easy to get wrong: a
 * rule that leaks into the standard game, and one that quietly breaks the bots.
 */
class ModifierTest {

    private static final long STEP = 100;

    private static MatchConfig config(Modifier modifier) {
        return new MatchConfig(3, 10, 1, 10_000, 12, 1.0, 1.0, modifier);
    }

    private static List<String> seats(int count) {
        List<String> ids = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            ids.add("p" + i);
        }
        return ids;
    }

    private static Match lobby(String code, Modifier modifier, int humans) {
        Match match = new Match(code, config(modifier));
        for (int i = 1; i <= humans; i++) {
            match.join("p" + i, "player" + i);
            match.markConnected("p" + i, true, 0);
        }
        return match;
    }

    private static List<GameEvent> startPlaying(Match match, long now) {
        List<GameEvent> events = new ArrayList<>(match.start(now));
        match.players().forEach(player -> {
            match.markConnected(player.id(), true, now);
            match.markReady(player.id());
        });
        events.addAll(match.tick(now));
        return events;
    }

    private static List<GameEvent> step(Match match, long from, long to) {
        List<GameEvent> events = new ArrayList<>();
        for (long t = from; t <= to; t += STEP) {
            events.addAll(match.tick(t));
        }
        return events;
    }

    @Test
    void allLiesDealsNobodyARealTip() {
        RoundPlanner planner = new RoundPlanner();
        List<String> ids = seats(6);

        for (int seed = 0; seed < 50; seed++) {
            RoundPlan plan = planner.plan(seed, 0, ids, List.of(), config(Modifier.ALL_LIES));

            assertThat(plan.truthfulTipCount()).as("seed=%d", seed).isZero();
            for (String id : ids) {
                assertThat(plan.rumorFor(id).truthful()).as("seed=%d seat=%s", seed, id).isFalse();
            }
        }
    }

    @Test
    void theStandardGameStillNeverDealsZeroOrEverything() {
        // Restated from RoundPlannerTest on purpose. The rule that a count of none or all
        // ends the round before it starts is the reason ALL_LIES has to be opted into, and a
        // future variant must not be able to weaken it by accident.
        Random random = new Random(20260821L);
        for (int players = 2; players <= 12; players++) {
            for (int i = 0; i < 200; i++) {
                int count = RoundPlanner.truthfulTipCount(players, random);
                assertThat(count).as("players=%d", players)
                        .isGreaterThanOrEqualTo(1)
                        .isLessThanOrEqualTo(players - 1);
            }
        }
    }

    @Test
    void theStandardGameStillDealsRealTipsWhenItPlansARound() {
        // Through plan(), not truthfulTipCount() directly. The modifier branch sits above
        // that method, so a variant leaking into the standard game does not show up in a
        // test that calls it straight — which is exactly how the first version of this suite
        // missed it.
        RoundPlanner planner = new RoundPlanner();
        List<String> ids = seats(6);

        for (int seed = 0; seed < 50; seed++) {
            RoundPlan plan = planner.plan(seed, 0, ids, List.of(), config(Modifier.NONE));
            long real = ids.stream().filter(id -> plan.rumorFor(id).truthful()).count();

            assertThat(plan.truthfulTipCount()).as("seed=%d", seed).isBetween(1, ids.size() - 1);
            assertThat(real).as("seed=%d", seed).isEqualTo(plan.truthfulTipCount());
        }
    }

    @Test
    void everyVariantStaysReproducibleFromItsSeed() {
        // Rematch-on-the-same-market rests on plan() being a pure function of its inputs, and
        // the modifier is one of those inputs now.
        RoundPlanner planner = new RoundPlanner();
        List<String> ids = seats(6);

        for (Modifier modifier : Modifier.values()) {
            for (int seed = 0; seed < 20; seed++) {
                RoundPlan first = planner.plan(seed, 1, ids, List.of(), config(modifier));
                RoundPlan second = planner.plan(seed, 1, ids, List.of(), config(modifier));

                assertThat(second.path().toArray()).as("%s seed=%d", modifier, seed)
                        .containsExactly(first.path().toArray());
                for (String id : ids) {
                    assertThat(second.rumorFor(id).text()).as("%s seed=%d seat=%s", modifier, seed, id)
                            .isEqualTo(first.rumorFor(id).text());
                    assertThat(second.rumorFor(id).truthful())
                            .isEqualTo(first.rumorFor(id).truthful());
                }
            }
        }
    }

    @Test
    void highRollerRefusesASmallPosition() {
        Match match = lobby("HRLL1", Modifier.HIGH_ROLLER, 2);
        startPlaying(match, 0);
        step(match, 0, 1_500);

        assertThatThrownBy(() -> match.openPosition("p1", Side.LONG, 0.5, 2, 1_600))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("between 5");

        assertThatCode(() -> match.openPosition("p1", Side.LONG, 0.5, 5, 1_600))
                .doesNotThrowAnyException();
    }

    @Test
    void theStandardGameStillTakesASinglePosition() {
        Match match = lobby("STD01", Modifier.NONE, 2);
        startPlaying(match, 0);
        step(match, 0, 1_500);

        assertThatCode(() -> match.openPosition("p1", Side.LONG, 0.5, 1, 1_600))
                .doesNotThrowAnyException();
    }

    @Test
    void highRollerDoesNotSilenceTheBots() {
        // A bot scripted below the floor throws inside openPosition, MatchEngine's per-match
        // catch swallows it, and the bot simply stops trading with nothing on screen to say
        // why. The clamp is invisible until you look for the events it produces.
        Match match = lobby("HRLL2", Modifier.HIGH_ROLLER, 1);
        for (int i = 0; i < 3; i++) {
            match.seatBot(List.of("Vega", "Nyx", "Rook"));
        }

        List<GameEvent> events = new ArrayList<>(startPlaying(match, 0));
        events.addAll(step(match, 0, 12_000));

        List<GameEvent.BotOpened> opens = events.stream()
                .filter(GameEvent.BotOpened.class::isInstance)
                .map(GameEvent.BotOpened.class::cast)
                .toList();

        assertThat(opens).as("bots must still trade under a leverage floor").isNotEmpty();
        assertThat(opens).allSatisfy(open ->
                assertThat(open.leverage()).isGreaterThanOrEqualTo(Modifier.HIGH_ROLLER.minLeverage()));
        assertThat(opens).allSatisfy(open ->
                assertThat(open.leverage()).isLessThanOrEqualTo(Position.MAX_LEVERAGE));
    }

    @Test
    void aRematchKeepsTheModifier() {
        Match match = lobby("RMTCH", Modifier.ALL_LIES, 2);
        startPlaying(match, 0);
        step(match, 0, 60_000);

        assertThat(match.phase()).isEqualTo(MatchPhase.FINISHED);
        match.rematch(true, 61_000);

        assertThat(match.config().modifier()).isEqualTo(Modifier.ALL_LIES);
    }

    @Test
    void anUnknownModifierNameIsTheStandardGameRatherThanAnError() {
        // The create endpoint is public, so a value nobody recognises has to mean "standard"
        // and not a 500.
        assertThat(Modifier.parse(null)).isEqualTo(Modifier.NONE);
        assertThat(Modifier.parse("")).isEqualTo(Modifier.NONE);
        assertThat(Modifier.parse("   ")).isEqualTo(Modifier.NONE);
        assertThat(Modifier.parse("DROP TABLE")).isEqualTo(Modifier.NONE);
        assertThat(Modifier.parse("all_lies")).isEqualTo(Modifier.ALL_LIES);
        assertThat(Modifier.parse(" HIGH_ROLLER ")).isEqualTo(Modifier.HIGH_ROLLER);
    }
}
