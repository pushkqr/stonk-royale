package com.pushkqr.springBackend.server;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The room cap decides how bad a create flood can get. This decides how easily one happens —
 * without it, a loop reaches all 150 rooms in under a second and every real visitor is told
 * the server is busy until the reaper catches up two minutes later.
 */
class CreateLimiterTest {

    private final CreateLimiter limiter = new CreateLimiter();

    @Test
    void lettsAClientMakeARoomAndThenAFewMore() {
        for (int i = 0; i < CreateLimiter.CAPACITY; i++) {
            assertThat(limiter.allow("1.2.3.4", 0)).as("create %d", i).isTrue();
        }
    }

    @Test
    void refusesTheOneAfterTheBurst() {
        for (int i = 0; i < CreateLimiter.CAPACITY; i++) {
            limiter.allow("1.2.3.4", 0);
        }
        assertThat(limiter.allow("1.2.3.4", 0)).isFalse();
    }

    @Test
    void handsBackOneTokenPerRefillWindow() {
        for (int i = 0; i < CreateLimiter.CAPACITY; i++) {
            limiter.allow("1.2.3.4", 0);
        }

        assertThat(limiter.allow("1.2.3.4", CreateLimiter.REFILL_MILLIS - 1)).isFalse();
        assertThat(limiter.allow("1.2.3.4", CreateLimiter.REFILL_MILLIS)).isTrue();
        assertThat(limiter.allow("1.2.3.4", CreateLimiter.REFILL_MILLIS)).isFalse();
    }

    @Test
    void neverHandsBackMoreThanTheBucketHolds() {
        for (int i = 0; i < CreateLimiter.CAPACITY; i++) {
            limiter.allow("1.2.3.4", 0);
        }

        // A day later the bucket is full, not overflowing — the burst is still bounded.
        long muchLater = 86_400_000L;
        for (int i = 0; i < CreateLimiter.CAPACITY; i++) {
            assertThat(limiter.allow("1.2.3.4", muchLater)).as("create %d", i).isTrue();
        }
        assertThat(limiter.allow("1.2.3.4", muchLater)).isFalse();
    }

    @Test
    void oneFloodDoesNotLockOutEverybodyElse() {
        // The whole reason the key is a client and not a global counter. Behind a proxy this
        // is also why the forwarded address is read in preference to the socket address:
        // every visitor would otherwise share this one bucket.
        for (int i = 0; i < CreateLimiter.CAPACITY * 3; i++) {
            limiter.allow("1.2.3.4", 0);
        }

        assertThat(limiter.allow("5.6.7.8", 0)).isTrue();
    }

    @Test
    void forgetsIdleClientsRatherThanGrowingForever() {
        // Nothing tells this class a visitor has gone, so without a sweep the map is a slow
        // leak for the life of the process. A refilled bucket holds nothing worth keeping.
        for (int i = 0; i <= CreateLimiter.SWEEP_ABOVE; i++) {
            limiter.allow("visitor-" + i, 0);
        }

        // Long enough for every one of those to have refilled to capacity.
        long later = CreateLimiter.REFILL_MILLIS * CreateLimiter.CAPACITY * 2;
        limiter.allow("someone-new", later);

        assertThat(limiter.trackedClients()).isLessThan(CreateLimiter.SWEEP_ABOVE);
    }
}
