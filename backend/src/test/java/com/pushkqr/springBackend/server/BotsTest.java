package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.model.MatchConfig;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BotsTest {

    @Test
    void everyBotSeatedGetsAnIdAndANameOfItsOwn() {
        Match match = new Match("AAAAA", MatchConfig.standard());
        match.join("human", "Ada");

        Bots.seat(match);
        Bots.seat(match);
        Bots.seat(match);

        assertThat(match.players()).extracting(p -> p.id()).doesNotHaveDuplicates();
        assertThat(match.players()).extracting(p -> p.nickname()).doesNotHaveDuplicates();
    }

    @Test
    void aBotNeverTakesTheNameOfSomebodyAlreadyInTheRoom() {
        Match match = new Match("AAAAA", MatchConfig.standard());
        // Whatever the first bot would have been called, a human got there first.
        String taken = Bots.NAMES.get(0);
        match.join("human", taken);

        Bots.seat(match);

        // Two of the same name makes the standings unreadable and every accusation ambiguous.
        assertThat(match.players()).extracting(p -> p.nickname()).doesNotHaveDuplicates();
    }

    @Test
    void theRoomCannotBeFilledPastItsOwnLimit() {
        Match match = new Match("AAAAA", new MatchConfig(1, 60, 8, 10_000, 4));
        match.join("human", "Ada");
        while (match.players().size() < match.config().maxPlayers()) {
            Bots.seat(match);
        }

        assertThatThrownBy(() -> Bots.seat(match)).isInstanceOf(IllegalStateException.class);
    }
}
