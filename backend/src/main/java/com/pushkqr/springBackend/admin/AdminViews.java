package com.pushkqr.springBackend.admin;

import java.util.List;

/** The admin panel's wire shapes, kept apart from the game's own views. */
public final class AdminViews {

    private AdminViews() {
    }

    public record Room(String code, int players, String phase, int round, int totalRounds) {
    }

    public record Lifetime(int devices, long seatsTaken, long matchesCreated, long matchesFinished,
            long roundsPlayed, long liquidations, long peakConcurrentPlayers,
            long firstSeenEpochMillis) {
    }

    /**
     * @param tickWorstMillis  the slowest full pass over every match in the last minute
     * @param tickMedianMillis the typical one
     * @param tickBudgetMillis what a pass has before it is late for every room at once
     * @param tickOverruns     passes over budget since boot — counted for the life of the
     *                         process, because a burst an hour ago still tells you the
     *                         box is at its limit
     */
    public record Server(long uptimeMillis, long heapUsedMb, long heapMaxMb, int threads,
            long tickWorstMillis, long tickMedianMillis, long tickBudgetMillis,
            long tickOverruns) {
    }

    public record Snapshot(List<Room> rooms, int playersNow, Lifetime lifetime, Server server,
            List<Telemetry> recentTelemetry) {
    }
}
