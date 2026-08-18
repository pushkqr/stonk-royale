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

    @Test
    void markingASeatTellsTheCallerWhetherAnythingActuallyChanged() {
        Match match = new Match("SEATS_TEST", new MatchConfig(1, 60, 8, 10_000, 12));
        match.join("player1", "Player1");
        String playerId = "player1";

        // The seat is already connected once its socket has opened, so saying so again is
        // not news and must not be broadcast.
        assertThat(match.markConnected(playerId, true, 1_000)).isTrue();
        assertThat(match.markConnected(playerId, true, 1_100)).isFalse();

        assertThat(match.markConnected(playerId, false, 1_200)).isTrue();
        assertThat(match.markConnected(playerId, false, 1_300)).isFalse();
    }

    @Test
    void markingASeatThatIsNotThereChangesNothing() {
        Match match = new Match("SEATS_TEST", new MatchConfig(1, 60, 8, 10_000, 12));
        match.join("player1", "Player1");

        assertThat(match.markConnected("nobody", false, 1_000)).isFalse();
    }

    @Test
    void leavingDuringAMatchGivesUpTheSeatWithoutErasingTheScore() {
        Match match = new Match("SEATS_INTERMISSION", new MatchConfig(2, 10, 1, 10_000, 12));
        match.join("host", "Host");
        match.join("guest", "Guest");
        match.markConnected("host", true, 0);
        match.markConnected("guest", true, 0);
        match.start(0);
        match.markReady("host");
        match.markReady("guest");
        match.tick(100);

        for (long t = 100; t <= 12_000; t += 100) {
            match.tick(t);
        }
        assertThat(match.phase()).isEqualTo(MatchPhase.INTERMISSION);

        String quitter = "guest";
        double earned = match.player(quitter).totalScore();

        // A deliberate Leave is not a dropped socket: it must be acted on, and the room
        // must be told. Today this returns false and the press is silently discarded.
        assertThat(match.leave(quitter, 12_100)).isTrue();

        MatchPlayer gone = match.player(quitter);
        assertThat(gone).isNotNull();
        assertThat(gone.hasLeft()).isTrue();
        // Kept, so the standings do not suddenly disagree with rounds that really happened.
        assertThat(gone.totalScore()).isEqualTo(earned);
    }

    @Test
    void somebodyWhoLeftIsNotDealtIntoTheNextRound() {
        Match match = new Match("SEATS_INTERMISSION2", new MatchConfig(2, 10, 1, 10_000, 12));
        match.join("host", "Host");
        match.join("guest", "Guest");
        match.markConnected("host", true, 0);
        match.markConnected("guest", true, 0);
        match.start(0);
        match.markReady("host");
        match.markReady("guest");
        match.tick(100);

        for (long t = 100; t <= 12_000; t += 100) {
            match.tick(t);
        }
        assertThat(match.phase()).isEqualTo(MatchPhase.INTERMISSION);

        String quitter = "guest";
        match.leave(quitter, 12_100);

        // Advance the clock past the intermission so the next round starts and trading begins.
        for (long t = 12_100; t <= 20_000; t += 100) {
            match.tick(t);
        }
        assertThat(match.phase()).isEqualTo(MatchPhase.TRADING);

        // Straight onto the latecomer path: no tip planned, so no stack allocated.
        assertThat(match.player(quitter).round()).isNull();
    }

    @Test
    void aSeatGivenUpMidMatchStopsHoldingASlot() {
        Match match = new Match("SEATS_FULL", new MatchConfig(2, 10, 1, 10_000, 2));
        match.join("host", "Host");
        match.join("guest", "Guest");
        match.markConnected("host", true, 0);
        match.markConnected("guest", true, 0);
        match.start(0);
        match.markReady("host");
        match.markReady("guest");
        match.tick(100);

        for (long t = 100; t <= 12_000; t += 100) {
            match.tick(t);
        }
        assertThat(match.phase()).isEqualTo(MatchPhase.INTERMISSION);

        String quitter = "guest";
        match.leave(quitter, 12_100);

        // The room was full only because of somebody who has gone. A latecomer should be
        // able to take the seat they gave up.
        assertThat(match.join("newcomer", "Newcomer")).isNotNull();
    }

    @Test
    void aReturningPlayerIsHandedTheirOwnSeatRatherThanTheirNameBeingTaken() {
        Match match = lobby();

        MatchPlayer back = match.join("guest", "Guest");

        assertThat(back.id()).isEqualTo("guest");
        assertThat(match.players()).hasSize(2);
    }

    @Test
    void somebodyWhoQuitMidMatchComesBackWithoutErasingTheScoreTheyLeftBehind() {
        Match match = lobby();
        // Out of the lobby, so leave() retires the seat instead of removing it outright.
        match.start(0);
        match.leave("guest", 1_000);
        assertThat(match.player("guest").hasLeft()).isTrue();

        MatchPlayer back = match.join("guest", "Guest");

        assertThat(back.id()).isNotEqualTo("guest");
        assertThat(back.hasLeft()).isFalse();
        // The retired record is what the standings read a departed player's score from.
        assertThat(match.player("guest")).isNotNull();
        assertThat(match.player("guest").hasLeft()).isTrue();
    }
}
