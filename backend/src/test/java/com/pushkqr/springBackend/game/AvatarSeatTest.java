package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.model.MatchConfig;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

class AvatarSeatTest {

    @Test
    void aReturningPlayerBringsTheirNewMarkWithThem() {
        Match match = new Match("AVATAR_TEST", new MatchConfig(1, 60, 8, 10_000, 12));
        match.join("p1", "Ana", "degen");
        assertEquals("degen", match.player("p1").avatar());

        // Same seat, different pick: the lobby picker can change it after seating.
        match.join("p1", "Ana", "whale");
        assertEquals("whale", match.player("p1").avatar());
    }

    @Test
    void anUnknownMarkFallsBackInsteadOfReachingTheSeat() {
        assertEquals("banker", Avatars.sanitise("not-an-archetype"));
        assertEquals("banker", Avatars.sanitise(null));
        assertEquals("degen", Avatars.sanitise("degen"));
    }

    @Test
    void botsDoNotAllWearTheSameMark() {
        assertNotEquals(Avatars.forSeed("bot:0"), Avatars.forSeed("bot:1"));
    }
}
