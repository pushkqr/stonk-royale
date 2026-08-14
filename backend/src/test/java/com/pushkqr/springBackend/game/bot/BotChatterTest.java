package com.pushkqr.springBackend.game.bot;

import com.pushkqr.springBackend.game.GameEvent;
import com.pushkqr.springBackend.game.MatchPhase;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BotChatterTest {

    private static final List<String> BOTS = List.of("bot:1", "bot:2", "bot:3");

    @Test
    void reactsToAHeadline() {
        BotChatter chatter = new BotChatter();
        assertThat(chatter.reactTo(new GameEvent.NewsBroken("BIG NEWS"), BOTS, null, 1_000))
                .isNotNull();
    }

    @Test
    void staysQuietInsideTheCooldown() {
        BotChatter chatter = new BotChatter();
        chatter.reactTo(new GameEvent.NewsBroken("ONE"), BOTS, null, 1_000);
        assertThat(chatter.reactTo(new GameEvent.NewsBroken("TWO"), BOTS, null, 2_000))
                .isNull();
        assertThat(chatter.reactTo(new GameEvent.NewsBroken("THREE"), BOTS, null, 6_000))
                .isNotNull();
    }

    @Test
    void neverReactsToItsOwnChatter() {
        BotChatter chatter = new BotChatter();
        assertThat(chatter.reactTo(new GameEvent.BotSaid("bot:1", "Vega", "hi"), BOTS, null, 1_000))
                .isNull();
        assertThat(chatter.reactTo(
                new GameEvent.PhaseChanged(MatchPhase.TRADING, 0, 0), BOTS, null, 1_000))
                .isNull();
    }

    @Test
    void aLiquidatedBotIsNotTheOneCommentingOnIt() {
        BotChatter chatter = new BotChatter();
        BotChatter.Reaction reaction = chatter.reactTo(
                new GameEvent.PlayerLiquidated("bot:1", "Vega", 900), BOTS, "bot:1", 1_000);

        assertThat(reaction).isNotNull();
        assertThat(reaction.botId()).isNotEqualTo("bot:1");
    }

    @Test
    void theSameEventSequenceAlwaysProducesTheSameTalk() {
        assertThat(run()).isEqualTo(run());
    }

    private List<BotChatter.Reaction> run() {
        BotChatter chatter = new BotChatter();
        return java.util.stream.Stream.of(
                        chatter.reactTo(new GameEvent.NewsBroken("A"), BOTS, null, 0),
                        chatter.reactTo(new GameEvent.FlowSurge(true), BOTS, null, 5_000),
                        chatter.reactTo(new GameEvent.PlayerLiquidated("x", "X", 1), BOTS, "x", 10_000))
                .filter(java.util.Objects::nonNull)
                .toList();
    }
}
