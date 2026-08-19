package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.PlayerSnapshot;
import com.pushkqr.springBackend.game.model.MatchConfig;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MatchBroadcasterTest {

    @Test
    void boardRowCarriesPlayerAvatar() {
        Match match = new Match("TEST", new MatchConfig(1, 10, 1, 10_000, 12));
        match.seat("p1", "Ana", "degen");
        match.seat("p2", "Bob", "quant");
        match.markConnected("p1", true, 0);
        match.markConnected("p2", true, 0);
        match.start(0);
        match.markReady("p1");
        match.markReady("p2");
        for (long t = 0; t <= 2_000; t += 100) {
            match.tick(t);
        }

        PlayerSnapshot snapshot = match.playerSnapshots(2_000).stream()
                .filter(p -> p.id().equals("p1"))
                .findFirst()
                .orElseThrow();
        assertTrue(snapshot.inRound(), "Player should be in an active trading round");

        MatchBroadcaster broadcaster = new MatchBroadcaster(null);
        Views.BoardRow row = broadcaster.boardRow(snapshot);

        assertEquals("degen", row.avatar());
    }
}
