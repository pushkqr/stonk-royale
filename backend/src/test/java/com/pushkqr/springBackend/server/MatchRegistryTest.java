package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.model.MatchConfig;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MatchRegistryTest {

    @Test
    void itStopsHandingOutRoomsItCannotKeepUpWith() {
        MatchRegistry registry = new MatchRegistry();
        for (int i = 0; i < MatchRegistry.MAX_LIVE_MATCHES; i++) {
            registry.create(MatchConfig.standard());
        }

        assertThatThrownBy(() -> registry.create(MatchConfig.standard()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("busy");
    }

    @Test
    void aRoomFreedUpMakesRoomForTheNextOne() {
        MatchRegistry registry = new MatchRegistry();
        String first = registry.create(MatchConfig.standard()).code();
        for (int i = 1; i < MatchRegistry.MAX_LIVE_MATCHES; i++) {
            registry.create(MatchConfig.standard());
        }
        registry.remove(first);

        // The cap has to count live rooms, not rooms ever created — otherwise a server
        // that has been up a week refuses everybody while sitting completely empty.
        assertThat(registry.create(MatchConfig.standard())).isNotNull();
    }
}
