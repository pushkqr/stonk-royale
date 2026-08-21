package com.pushkqr.springBackend.server;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * How often one client may make the server build a new room.
 *
 * {@link MatchRegistry#MAX_LIVE_MATCHES} already bounds the damage at 150 rooms, but nothing
 * bounded the rate — and a loop over the create endpoint reaches that ceiling in under a
 * second. Every real visitor then gets "the server is busy" until the abandoned-room reaper
 * clears them two minutes later. The cap decides how bad it can get; this decides how easily.
 *
 * A bucket rather than a cooldown, matching {@link ChatLimiter}, because the honest burst is
 * real: somebody makes a room, misjudges the settings, leaves and makes another. Five is
 * comfortably more than that and still turns 150 rooms a second into five a minute.
 *
 * Rejection here is loud, unlike the Wire's. A dropped chat line is a message nobody sees; a
 * dropped create is a button that did nothing, so it has to come back as an error the player
 * can read.
 *
 * Time is a parameter and never read from the clock, for the same reason Match.tick takes it:
 * a rate limiter you cannot test at made-up timestamps is one you find out about in
 * production.
 */
@Component
public class CreateLimiter {

    /** Enough for a misjudged room, a rematch and a change of mind, back to back. */
    static final int CAPACITY = 5;

    /** One returned every twelve seconds, so five a minute sustained. */
    static final long REFILL_MILLIS = 12_000;

    /**
     * When to bother sweeping. Unlike the Wire's buckets, which are dropped with their match,
     * these are keyed by client and nothing ever tells us a client has gone — so without this
     * the map is a slow leak for the life of the process. A bucket that has refilled to
     * capacity holds no state that matters, which is what makes it safe to forget.
     */
    static final int SWEEP_ABOVE = 10_000;

    private final ConcurrentMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    private static final class Bucket {
        private int tokens;
        private long lastRefill;

        Bucket(long now) {
            this.tokens = CAPACITY;
            this.lastRefill = now;
        }

        synchronized boolean allow(long now) {
            refill(now);
            if (tokens > 0) {
                tokens--;
                return true;
            }
            return false;
        }

        synchronized boolean isSpent(long now) {
            refill(now);
            return tokens >= CAPACITY;
        }

        private void refill(long now) {
            if (now <= lastRefill) {
                return;
            }
            long elapsed = now - lastRefill;
            int replenished = (int) (elapsed / REFILL_MILLIS);
            if (replenished > 0) {
                tokens = Math.min(CAPACITY, tokens + replenished);
                if (tokens == CAPACITY) {
                    lastRefill = now;
                } else {
                    lastRefill += (long) replenished * REFILL_MILLIS;
                }
            }
        }
    }

    /**
     * @param client an opaque key for whoever is asking — see MatchController.clientKey
     * @return true when the room may be built, false when the request is refused
     */
    public boolean allow(String client, long now) {
        if (buckets.size() > SWEEP_ABOVE) {
            buckets.values().removeIf(bucket -> bucket.isSpent(now));
        }
        return buckets.computeIfAbsent(client, key -> new Bucket(now)).allow(now);
    }

    /** How many clients are being remembered. Exists so the sweep above can be tested. */
    int trackedClients() {
        return buckets.size();
    }
}
