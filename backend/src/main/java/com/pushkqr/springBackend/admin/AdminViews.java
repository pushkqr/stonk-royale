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

    public record Server(long uptimeMillis, long heapUsedMb, long heapMaxMb, int threads) {
    }

    public record Snapshot(List<Room> rooms, int playersNow, Lifetime lifetime, Server server,
            List<Telemetry> recentTelemetry) {
    }
}
