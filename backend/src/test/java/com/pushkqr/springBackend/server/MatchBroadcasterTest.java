package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.MatchPlayer;
import com.pushkqr.springBackend.game.model.MatchConfig;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class MatchBroadcasterTest {

    @Test
    void boardRowCarriesPlayerAvatar() {
        Match match = new Match("TEST", new MatchConfig(1, 10, 1, 10_000, 12));
        MatchPlayer player = match.join("p1", "Ana", "degen");
        match.join("p2", "Bob", "quant");
        match.markConnected("p1", true, 0);
        match.markConnected("p2", true, 0);
        match.start(0);
        match.markReady("p1");
        match.markReady("p2");
        for (long t = 0; t <= 2_000; t += 100) {
            match.tick(t);
        }
        assertNotNull(player.round(), "Player should be in an active trading round");

        MatchBroadcaster broadcaster = new MatchBroadcaster(null);
        Views.BoardRow row = broadcaster.boardRow(player, 100.0);

        assertEquals("degen", row.avatar());
    }
}
