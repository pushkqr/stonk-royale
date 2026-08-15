package com.pushkqr.springBackend.server;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MatchEngineBroadcastTest {

    @Test
    void aRoomWithNobodyWatchingIsNotWorthBroadcastingTo() {
        assertThat(MatchEngine.worthBroadcasting(0)).isTrue();
        assertThat(MatchEngine.worthBroadcasting(1_700_000_000_000L)).isFalse();
    }

    @Test
    void boardsAreSpreadAcrossTheWindowRatherThanArrivingTogether() {
        // Checked across a full window so the assertion does not depend on one tick.
        int shared = 0;
        for (long tick = 0; tick < 5; tick++) {
            if (MatchEngine.boardDue(tick, "CODE1") && MatchEngine.boardDue(tick, "CODE2")) {
                shared++;
            }
        }
        assertThat(shared).isZero();
    }

    @Test
    void everyRoomStillGetsExactlyOneBoardPerWindow() {
        int due = 0;
        for (long tick = 0; tick < 5; tick++) {
            if (MatchEngine.boardDue(tick, "CODE1")) {
                due++;
            }
        }
        assertThat(due).isEqualTo(1);
    }
}
