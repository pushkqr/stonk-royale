package com.pushkqr.springBackend.admin;

import java.util.HashSet;
import java.util.Set;

/**
 * The counters that outlive a restart.
 *
 * A mutable class rather than a record because Jackson round-trips it to disk and the
 * service updates fields in place under a lock. Everything here is cheap to keep except
 * {@link #devices}, which is the one unbounded thing in the file — see
 * {@link Stats#MAX_DEVICES} for the ceiling that keeps it from growing forever.
 */
public class Totals {

    /** Distinct devices that have ever taken a seat, by the id their browser generated. */
    public Set<String> devices = new HashSet<>();

    public long matchesCreated;
    public long matchesFinished;
    public long roundsPlayed;
    public long seatsTaken;
    public long liquidations;
    public long peakConcurrentPlayers;
    public long firstSeenEpochMillis;
}
