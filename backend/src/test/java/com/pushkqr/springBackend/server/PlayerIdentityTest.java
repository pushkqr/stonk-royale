package com.pushkqr.springBackend.server;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class PlayerIdentityTest {

    private final PlayerIdentity identity = new PlayerIdentity(Optional.empty());

    @Test
    void aGuestComingBackOnTheSameBrowserIsTheSamePlayer() {
        String first = identity.resolve(null, "device-abc");
        String second = identity.resolve(null, "device-abc");

        assertThat(first).isEqualTo(second).startsWith("guest:");
    }

    @Test
    void aGuestWithNoDeviceIdStillGetsAnIdentityOfTheirOwn() {
        String missing = identity.resolve(null, null);
        String blank = identity.resolve(null, "  ");

        assertThat(missing).isNotEqualTo(blank);
        assertThat(missing).startsWith("guest:");
        assertThat(blank).startsWith("guest:");
    }
}
