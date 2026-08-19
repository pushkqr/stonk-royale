package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.model.MatchConfig;
import com.pushkqr.springBackend.game.sim.Regime;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.assertj.core.api.Assertions.assertThat;

class ChatLimiterTest {

    @Test
    void allowsBurstUpToCapacityAndRefusesTheNext() {
        ChatLimiter limiter = new ChatLimiter();
        long now = 1000L;

        for (int i = 0; i < 6; i++) {
            assertThat(limiter.allow("ROOM1", "P1", now)).isTrue();
        }
        assertThat(limiter.allow("ROOM1", "P1", now)).isFalse();
    }

    @Test
    void allowsAgainOnceRefillIntervalPasses() {
        ChatLimiter limiter = new ChatLimiter();
        long now = 1000L;

        for (int i = 0; i < 6; i++) {
            limiter.allow("ROOM1", "P1", now);
        }
        assertThat(limiter.allow("ROOM1", "P1", now)).isFalse();

        long next = now + ChatLimiter.REFILL_MILLIS;
        assertThat(limiter.allow("ROOM1", "P1", next)).isTrue();
        assertThat(limiter.allow("ROOM1", "P1", next)).isFalse();
    }

    @Test
    void refillsFractionallyWithoutThrowingAwayResidualTime() {
        ChatLimiter limiter = new ChatLimiter();
        long now = 1000L;

        // Exhaust initial burst
        for (int i = 0; i < 6; i++) {
            limiter.allow("ROOM1", "P1", now);
        }

        // Call every REFILL_MILLIS / 2 for 20 refill cycles (40 calls)
        long step = ChatLimiter.REFILL_MILLIS / 2;
        int allowed = 0;
        int totalCalls = 40;
        for (int i = 1; i <= totalCalls; i++) {
            if (limiter.allow("ROOM1", "P1", now + i * step)) {
                allowed++;
            }
        }

        // In 20 refill cycles, we should receive exactly 20 tokens
        int expectedSustained = (int) ((totalCalls * step) / ChatLimiter.REFILL_MILLIS);
        assertThat(allowed).isBetween(expectedSustained - 1, expectedSustained + 1);
        assertThat(allowed).isEqualTo(20);
    }

    @Test
    void neverExceedsCapacityAfterLongIdlePeriod() {
        ChatLimiter limiter = new ChatLimiter();
        long now = 1000L;

        // Initial burst
        for (int i = 0; i < 6; i++) {
            limiter.allow("ROOM1", "P1", now);
        }

        // Idle for 5 minutes (300,000ms)
        long fiveMinutesLater = now + 300_000L;

        // Should allow only CAPACITY tokens
        for (int i = 0; i < 6; i++) {
            assertThat(limiter.allow("ROOM1", "P1", fiveMinutesLater)).isTrue();
        }
        assertThat(limiter.allow("ROOM1", "P1", fiveMinutesLater)).isFalse();
    }

    @Test
    void twoPlayersInOneRoomHaveIndependentBudgets() {
        ChatLimiter limiter = new ChatLimiter();
        long now = 1000L;

        for (int i = 0; i < 6; i++) {
            assertThat(limiter.allow("ROOM1", "P1", now)).isTrue();
        }
        assertThat(limiter.allow("ROOM1", "P1", now)).isFalse();

        // Player 2 still has full capacity
        for (int i = 0; i < 6; i++) {
            assertThat(limiter.allow("ROOM1", "P2", now)).isTrue();
        }
        assertThat(limiter.allow("ROOM1", "P2", now)).isFalse();
    }

    @Test
    void forgetMatchDropsMatchBucketsAndLeavesOtherMatchesAlone() {
        ChatLimiter limiter = new ChatLimiter();
        long now = 1000L;

        for (int i = 0; i < 6; i++) {
            limiter.allow("ROOM1", "P1", now);
            limiter.allow("ROOM2", "P2", now);
        }
        assertThat(limiter.allow("ROOM1", "P1", now)).isFalse();
        assertThat(limiter.allow("ROOM2", "P2", now)).isFalse();

        limiter.forgetMatch("ROOM1");

        // P1 in ROOM1 is now a fresh arrival with full capacity
        assertThat(limiter.allow("ROOM1", "P1", now)).isTrue();

        // P2 in ROOM2 remains exhausted
        assertThat(limiter.allow("ROOM2", "P2", now)).isFalse();
    }

    @Test
    void rateLimitedChatLeavesTipClaimsUnchanged() {
        MatchRegistry registry = new MatchRegistry();
        Match match = registry.create(MatchConfig.standard());
        match.seat("P1", "Alice", null);
        match.seat("P2", "Bob", null);
        match.markConnected("P1", true, 1000L);
        match.markConnected("P2", true, 1000L);
        match.start(1000L);
        match.markReady("P1");
        match.markReady("P2");
        match.tick(1000L);

        SessionRegistry sessions = new SessionRegistry();
        MatchBroadcaster broadcaster = Mockito.mock(MatchBroadcaster.class);
        ChatLimiter limiter = new ChatLimiter();

        MatchSocketController controller = new MatchSocketController(registry, broadcaster, sessions, limiter);
        PlayerSession principal = new PlayerSession("tok1", "P1", "Alice", match.code());

        // Exhaust limiter
        for (int i = 0; i < 6; i++) {
            controller.chat(match.code(), new Requests.Chat("my tip says PUMP", "PUMP"), principal);
        }
        assertThat(match.tipClaims()).containsEntry("P1", Regime.PUMP);

        // Next chat should be dropped silently by limiter and NOT update tip claim to DUMP
        controller.chat(match.code(), new Requests.Chat("my tip says DUMP", "DUMP"), principal);
        assertThat(match.tipClaims()).containsEntry("P1", Regime.PUMP);
    }
}
