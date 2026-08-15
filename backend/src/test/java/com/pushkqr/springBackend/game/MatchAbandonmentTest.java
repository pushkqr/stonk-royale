package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.model.MatchConfig;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MatchAbandonmentTest {

    private Match lobbyWith(String... playerIds) {
        Match match = new Match("ABAND", new MatchConfig(1, 60, 8, 10_000, 12));
        for (String id : playerIds) {
            match.join(id, id);
        }
        return match;
    }

    @Test
    void aSeatWithoutASocketIsNotSomebodyWatching() {
        // The whole leak in one assertion: a code was taken over HTTP and the tab closed
        // before the socket ever opened, so no disconnect event will ever arrive.
        Match match = lobbyWith("ghost");
        match.tick(1_000);

        assertThat(match.abandonedSinceMillis()).isEqualTo(1_000);
    }

    @Test
    void aConnectedPlayerKeepsTheRoomAlive() {
        Match match = lobbyWith("human");
        match.markConnected("human", true, 0);
        match.tick(1_000);

        assertThat(match.abandonedSinceMillis()).isZero();
    }

    @Test
    void theClockStartsWhenTheLastSocketGoesAndResetsWhenOneComesBack() {
        Match match = lobbyWith("human");
        match.markConnected("human", true, 0);
        match.tick(1_000);

        match.markConnected("human", false, 1_500);
        match.tick(2_000);
        assertThat(match.abandonedSinceMillis()).isEqualTo(2_000);

        // Still the same moment — the clock marks when they went, not every tick since.
        match.tick(3_000);
        assertThat(match.abandonedSinceMillis()).isEqualTo(2_000);

        match.markConnected("human", true, 3_500);
        match.tick(4_000);
        assertThat(match.abandonedSinceMillis()).isZero();
    }

    @Test
    void botsDoNotCountAsSomebodyWatching() {
        Match match = new Match("ABAND2", new MatchConfig(1, 60, 8, 10_000, 12));
        match.join("human", "You");
        match.addBot("bot:1", "Vega");
        match.markConnected("bot:1", true, 0);
        match.tick(1_000);

        // The human never connected; three bots must not hold a practice room open.
        assertThat(match.abandonedSinceMillis()).isEqualTo(1_000);
    }
}
