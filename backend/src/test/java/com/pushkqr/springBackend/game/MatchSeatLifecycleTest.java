package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.model.MatchConfig;
import com.pushkqr.springBackend.game.model.Side;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MatchSeatLifecycleTest {

    private Match lobby() {
        Match match = new Match("SEATS", new MatchConfig(1, 60, 8, 10_000, 12));
        match.join("host", "Host");
        match.join("guest", "Guest");
        match.markConnected("host", true, 0);
        match.markConnected("guest", true, 0);
        return match;
    }

    @Test
    void aRefreshInsideTheGraceWindowKeepsTheSeat() {
        Match match = lobby();
        match.markConnected("guest", false, 1_000);

        // Back a couple of seconds later, which is what a page reload looks like.
        match.tick(3_000);
        match.markConnected("guest", true, 3_500);
        match.tick(60_000);

        assertThat(match.player("guest")).isNotNull();
    }

    @Test
    void aSeatNobodyComesBackToIsFreed() {
        Match match = lobby();
        match.markConnected("guest", false, 1_000);

        List<GameEvent> events = match.tick(1_000 + Match.SEAT_GRACE_MILLIS + 1);

        assertThat(match.player("guest")).isNull();
        assertThat(events)
                .filteredOn(GameEvent.SeatVacated.class::isInstance)
                .extracting(e -> ((GameEvent.SeatVacated) e).playerId())
                .containsExactly("guest");
    }

    @Test
    void aVacatedHostHandsTheBadgeOn() {
        Match match = lobby();
        match.markConnected("host", false, 1_000);
        match.tick(1_000 + Match.SEAT_GRACE_MILLIS + 1);

        assertThat(match.player("host")).isNull();
        assertThat(match.player("guest").isHost()).isTrue();
    }

    @Test
    void midMatchSeatsAreNeverFreedByTheGraceTimer() {
        Match match = lobby();
        match.start(0);
        match.markReady("host");
        match.markReady("guest");
        match.tick(100);

        match.markConnected("guest", false, 1_000);
        match.tick(1_000 + Match.SEAT_GRACE_MILLIS + 1);

        // Kept on purpose: standings that reference somebody who vanished halfway are
        // better than standings that quietly lost them.
        assertThat(match.player("guest")).isNotNull();
    }

    @Test
    void botsAreNeverTouchedByTheGraceTimer() {
        Match match = new Match("SEATS2", new MatchConfig(1, 60, 8, 10_000, 12));
        match.join("human", "You");
        match.markConnected("human", true, 0);
        match.addBot("bot:1", "Vega");

        match.tick(Match.SEAT_GRACE_MILLIS + 1);

        assertThat(match.player("bot:1")).isNotNull();
    }

    @Test
    void aSeatWhoseSocketNeverOpensIsGivenUpToo() {
        Match match = new Match("SEATS3", new MatchConfig(1, 60, 8, 10_000, 12));
        match.join("host", "Host");
        match.markConnected("host", true, 0);
        // Took a code over HTTP and never opened a socket, so nothing ever disconnected and
        // nothing ever started this seat's clock.
        match.join("ghost", "Ghost");

        match.tick(1_000);
        assertThat(match.player("ghost")).isNotNull();

        match.tick(1_000 + Match.SEAT_GRACE_MILLIS + 1);

        // The host is still connected, so the abandonment reaper never fires on this room —
        // without a clock of its own the ghost seat would be held for the life of the
        // process, holding a slot and showing in the lobby.
        assertThat(match.player("ghost")).isNull();
        assertThat(match.player("host")).isNotNull();
    }

    @Test
    void aLatecomerSitsOutTheRoundTheyArrivedIn() {
        Match match = lobby();
        match.start(0);
        match.markReady("host");
        match.markReady("guest");
        match.tick(100);
        // Into trading.
        for (long t = 100; t <= 8_200; t += 100) {
            match.tick(t);
        }
        assertThat(match.phase()).isEqualTo(MatchPhase.TRADING);

        match.join("late", "Late");
        match.markConnected("late", true, 8_300);

        // No tip and no round: the market they walked into was dealt without them.
        assertThat(match.rumorFor("late")).isNull();
        assertThat(match.player("late").round()).isNull();
    }

    @Test
    void settlingARoundWithALatecomerInTheRoomDoesNotThrow() {
        Match match = lobby();
        match.start(0);
        match.markReady("host");
        match.markReady("guest");
        match.tick(100);
        for (long t = 100; t <= 8_200; t += 100) {
            match.tick(t);
        }
        match.join("late", "Late");

        // Run out the round. Settlement walks every player, and a seat with no round and no
        // tip used to take the whole tick down with it.
        assertThatCode(() -> {
            for (long t = 8_300; t <= 80_000; t += 100) {
                match.tick(t);
            }
        }).doesNotThrowAnyException();
    }

    @Test
    void aLatecomerScoresNothingForTheRoundTheyMissed() {
        Match match = lobby();
        match.start(0);
        match.markReady("host");
        match.markReady("guest");
        match.tick(100);
        for (long t = 100; t <= 8_200; t += 100) {
            match.tick(t);
        }
        match.join("late", "Late");
        for (long t = 8_300; t <= 80_000; t += 100) {
            match.tick(t);
        }

        // Present in the standings, but with no round on their record — they did not play it,
        // and a recorded zero would read as having played and broken even.
        assertThat(match.standings()).extracting(Standing::nickname).contains("Late");
        assertThat(match.player("late").roundScores()).isEmpty();
    }

    @Test
    void aLatecomerCannotTradeUntilTheNextRound() {
        Match match = lobby();
        match.start(0);
        match.markReady("host");
        match.markReady("guest");
        match.tick(100);
        for (long t = 100; t <= 8_200; t += 100) {
            match.tick(t);
        }
        match.join("late", "Late");

        assertThatThrownBy(() ->
                match.openPosition("late", Side.LONG, 0.5, 2, 8_300))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("next round");
    }
}
