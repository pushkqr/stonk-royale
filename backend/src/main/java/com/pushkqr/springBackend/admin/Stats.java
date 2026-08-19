package com.pushkqr.springBackend.admin;

import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.PlayerSnapshot;
import com.pushkqr.springBackend.server.MatchRegistry;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.List;

/**
 * Everything the admin panel reports.
 *
 * Live figures are read straight off {@link MatchRegistry} on request — there is no point
 * mirroring state that already exists. Only the cumulative counters are kept here, because
 * they are the ones nothing else remembers.
 */
@Service
public class Stats {

    /**
     * A ceiling on the device set, which is the only part of the file that grows with use.
     * Well past anything this game will see, and it stops a stats file becoming a problem
     * if it ever does.
     */
    static final int MAX_DEVICES = 50_000;

    /**
     * Telemetry arrives on a public endpoint, so it is held in a fixed-size ring rather
     * than a list. Without a ceiling, anyone who found the URL could grow the heap until
     * the server died.
     */
    private static final int MAX_REPORTS = 200;

    private final MatchRegistry matches;
    private final StatsStore store;
    private final TickMeter tickMeter;
    private final Totals totals;

    private final Deque<Telemetry> reports = new ArrayDeque<>();

    private final long startedAtMillis = System.currentTimeMillis();
    private boolean dirty;

    public Stats(MatchRegistry matches, StatsStore store, TickMeter tickMeter) {
        this.matches = matches;
        this.store = store;
        this.tickMeter = tickMeter;
        this.totals = store.load();
        if (totals.firstSeenEpochMillis == 0) {
            totals.firstSeenEpochMillis = System.currentTimeMillis();
            this.dirty = true;
        }
    }

    // --- recording ------------------------------------------------------------

    public synchronized void matchCreated() {
        totals.matchesCreated++;
        dirty = true;
    }

    public synchronized void matchFinished() {
        totals.matchesFinished++;
        dirty = true;
    }

    public synchronized void roundPlayed() {
        totals.roundsPlayed++;
        dirty = true;
    }

    public synchronized void liquidated() {
        totals.liquidations++;
        dirty = true;
    }

    /**
     * A player took a seat. The device id is whatever their browser generated and kept, so
     * the same person rejoining is not counted twice — the closest this game gets to
     * knowing how many people have actually played it.
     */
    public synchronized void seatTaken(String deviceId) {
        totals.seatsTaken++;
        if (deviceId != null && !deviceId.isBlank() && totals.devices.size() < MAX_DEVICES) {
            totals.devices.add(deviceId);
        }
        checkPeakConcurrent();
        dirty = true;
    }

    public synchronized void checkPeakConcurrent() {
        int playersNow = (int) matches.all().stream()
                .mapToLong(Match::humanCount)
                .sum();
        if (playersNow > totals.peakConcurrentPlayers) {
            totals.peakConcurrentPlayers = playersNow;
            dirty = true;
        }
    }

    public synchronized void report(Telemetry telemetry) {
        reports.addLast(telemetry);
        while (reports.size() > MAX_REPORTS) {
            reports.removeFirst();
        }
    }

    // --- reading --------------------------------------------------------------

    public synchronized AdminViews.Snapshot snapshot() {
        List<AdminViews.Room> rooms = matches.all().stream()
                .map(this::roomOf)
                .sorted(Comparator.comparing(AdminViews.Room::code))
                .toList();

        int playersNow = rooms.stream().mapToInt(AdminViews.Room::players).sum();
        if (playersNow > totals.peakConcurrentPlayers) {
            totals.peakConcurrentPlayers = playersNow;
            dirty = true;
        }

        Runtime runtime = Runtime.getRuntime();
        long usedMb = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);

        return new AdminViews.Snapshot(
                rooms,
                playersNow,
                new AdminViews.Lifetime(
                        totals.devices.size(),
                        totals.seatsTaken,
                        totals.matchesCreated,
                        totals.matchesFinished,
                        totals.roundsPlayed,
                        totals.liquidations,
                        totals.peakConcurrentPlayers,
                        totals.firstSeenEpochMillis),
                new AdminViews.Server(
                        System.currentTimeMillis() - startedAtMillis,
                        usedMb,
                        runtime.maxMemory() / (1024 * 1024),
                        Thread.activeCount(),
                        tickMeter.worstMillis(),
                        tickMeter.medianMillis(),
                        tickMeter.budgetMillis(),
                        tickMeter.overruns()),
                new ArrayList<>(reports));
    }

    /**
     * One snapshot for the whole room rather than three passes over the roster.
     *
     * This method used to read PlayerRound directly from the admin's own request thread
     * while the engine was mutating it — close() writes cash and nulls the position without
     * either being atomic, so a refresh landing mid-close could read a position that had
     * already been paid out.
     */
    private AdminViews.Room roomOf(Match match) {
        long now = System.currentTimeMillis();
        double livePrice = match.currentPrice(now);
        String ticker = match.round() != null && match.round().asset() != null
                ? match.round().asset().ticker()
                : "—";

        List<PlayerSnapshot> snapshots = match.playerSnapshots(now);
        List<PlayerSnapshot> activeSnapshots = snapshots.stream()
                .filter(p -> !p.left())
                .toList();

        List<AdminViews.PlayerDetail> playerDetails = activeSnapshots.stream()
                .map(p -> {
                    PlayerSnapshot.Open pos = p.position();
                    return new AdminViews.PlayerDetail(
                            p.id(),
                            p.nickname(),
                            p.bot(),
                            p.connected(),
                            p.inRound() ? p.cash() : 0.0,
                            p.inRound() ? p.equity() : 0.0,
                            p.inRound() ? p.scoreAt() : p.totalScore(),
                            pos != null ? pos.side() : null,
                            pos != null ? pos.leverage() : 0,
                            pos != null ? pos.entryPrice() : 0.0,
                            pos != null ? pos.unrealisedPnl() : 0.0);
                })
                .toList();

        int humanCount = (int) activeSnapshots.stream()
                .filter(p -> !p.bot())
                .count();

        return new AdminViews.Room(
                match.code(),
                activeSnapshots.size(),
                humanCount,
                match.phase().name(),
                match.roundIndex() + 1,
                match.config().rounds(),
                ticker,
                livePrice,
                playerDetails);
    }

    // --- persistence ----------------------------------------------------------

    /**
     * Batched rather than written on every increment: a settling round can move four
     * counters at once, and none of them is worth a disk write on its own.
     */
    @Scheduled(fixedDelay = 30_000)
    public synchronized void flush() {
        if (!dirty) {
            return;
        }
        store.save(totals);
        dirty = false;
    }
}
