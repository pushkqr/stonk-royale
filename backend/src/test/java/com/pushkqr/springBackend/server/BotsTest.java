package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.PlayerSnapshot;
import com.pushkqr.springBackend.game.model.MatchConfig;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BotsTest {

    @Test
    void everyBotSeatedGetsAnIdAndANameOfItsOwn() {
        Match match = new Match("AAAAA", MatchConfig.standard());
        match.seat("human", "Ada", "banker");

        Bots.seat(match);
        Bots.seat(match);
        Bots.seat(match);

        assertThat(match.playerSnapshots(0)).extracting(PlayerSnapshot::id).doesNotHaveDuplicates();
        assertThat(match.playerSnapshots(0)).extracting(PlayerSnapshot::nickname).doesNotHaveDuplicates();
    }

    @Test
    void aBotNeverTakesTheNameOfSomebodyAlreadyInTheRoom() {
        Match match = new Match("AAAAA", MatchConfig.standard());
        // Whatever the first bot would have been called, a human got there first.
        String taken = Bots.NAMES.get(0);
        match.seat("human", taken, "banker");

        Bots.seat(match);

        // Two of the same name makes the standings unreadable and every accusation ambiguous.
        assertThat(match.playerSnapshots(0)).extracting(PlayerSnapshot::nickname).doesNotHaveDuplicates();
    }

    @Test
    void theRoomCannotBeFilledPastItsOwnLimit() {
        Match match = new Match("AAAAA", new MatchConfig(1, 60, 8, 10_000, 4));
        match.seat("human", "Ada", "banker");
        while (match.playerCount() < match.config().maxPlayers()) {
            Bots.seat(match);
        }

        assertThatThrownBy(() -> Bots.seat(match)).isInstanceOf(IllegalStateException.class);
    }
}
