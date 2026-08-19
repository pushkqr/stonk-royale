package com.pushkqr.springBackend.server;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * How often one player may put a line on the Wire.
 *
 * The Wire carries sixteen one-tap buttons and, until this existed, nothing on either side
 * of the socket limited how fast they could be pressed. That matters more than ordinary chat
 * spam would, because news headlines share the stream: a player leaning on the reaction row
 * pushes the round's actual information out of the panel for everybody.
 *
 * A bucket rather than a flat cooldown, because real play comes in bursts — somebody
 * answers an accusation with three taps in two seconds, and that is the game working. The
 * capacity is what allows the burst; the refill is what stops it continuing.
 *
 * Rejection is silent by design. Handler exceptions surface as a banner the player has to
 * dismiss, and covering a live round with one because somebody double-tapped would be worse
 * than the flood. The client carries a slightly tighter budget of its own, so an honest
 * player never reaches this — anything that does get here is a client that went around it.
 *
 * Time is a parameter, never read from the clock, for the same reason Match.tick takes it:
 * a rate limiter you cannot test at made-up timestamps is one you find out about in
 * production.
 */
@Component
public class ChatLimiter {

    /** A burst this long is somebody answering an accusation, not somebody flooding. */
    static final int CAPACITY = 6;

    /** Sustained rate once the burst is spent: a little under one line a second. */
    static final long REFILL_MILLIS = 1200;

    private final ConcurrentMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    private static final class Bucket {
        private final String matchCode;
        private int tokens;
        private long lastRefill;

        Bucket(String matchCode, long now) {
            this.matchCode = matchCode;
            this.tokens = CAPACITY;
            this.lastRefill = now;
        }

        synchronized boolean allow(long now) {
            if (now > lastRefill) {
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
            if (tokens > 0) {
                tokens--;
                return true;
            }
            return false;
        }
    }

    /**
     * @return true when the message may go out, false when it is dropped
     */
    public boolean allow(String matchCode, String playerId, long now) {
        Bucket bucket = buckets.computeIfAbsent(playerId, id -> new Bucket(matchCode, now));
        return bucket.allow(now);
    }

    /**
     * Drops every bucket for a match, called where its sessions are dropped.
     */
    public void forgetMatch(String matchCode) {
        buckets.values().removeIf(bucket -> bucket.matchCode.equals(matchCode));
    }
}
