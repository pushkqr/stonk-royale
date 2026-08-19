package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.model.MatchConfig;
import com.pushkqr.springBackend.game.model.Side;
import com.pushkqr.springBackend.game.sim.Regime;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class MatchConcurrencyTest {

    @Test
    void concurrentOrdersAndTicksNeverCorruptMatchState() throws Exception {
        int threadCount = 10;
        int operationsPerThread = 200;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);

        Match match = new Match("CONCU", new MatchConfig(3, 30, 10, 10_000, 12));
        for (int i = 0; i < 6; i++) {
            match.join("player-" + i, "Player-" + i);
            match.markConnected("player-" + i, true, 0);
        }
        match.start(0);

        List<Callable<Void>> tasks = new ArrayList<>();
        AtomicInteger successfulOpens = new AtomicInteger();
        AtomicInteger successfulCloses = new AtomicInteger();

        for (int i = 0; i < threadCount; i++) {
            final int threadId = i;
            tasks.add(() -> {
                startLatch.await(5, TimeUnit.SECONDS);
                for (int j = 0; j < operationsPerThread; j++) {
                    long now = j * 100L;
                    String playerId = "player-" + (threadId % 6);

                    // Randomly interleave ticks, orders, closes, tip claims, and standings reads
                    int op = (threadId + j) % 5;
                    switch (op) {
                        case 0 -> match.tick(now);
                        case 1 -> {
                            try {
                                match.openPosition(playerId, Side.LONG, 0.5, 3, now);
                                successfulOpens.incrementAndGet();
                            } catch (IllegalStateException | IllegalArgumentException ignored) {
                                // Expected when not in TRADING or position already held
                            }
                        }
                        case 2 -> {
                            try {
                                match.closePosition(playerId, now);
                                successfulCloses.incrementAndGet();
                            } catch (IllegalStateException | IllegalArgumentException ignored) {
                                // Expected when no open position
                            }
                        }
                        case 3 -> match.recordTipClaim(playerId, Regime.PUMP);
                        case 4 -> {
                            assertThat(match.standings()).isNotNull();
                            assertThat(match.players()).isNotEmpty();
                        }
                    }
                }
                return null;
            });
        }

        startLatch.countDown();
        List<Future<Void>> futures = executor.invokeAll(tasks);
        for (Future<Void> future : futures) {
            future.get(10, TimeUnit.SECONDS);
        }

        executor.shutdown();
        assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();

        // Match state must be completely intact and valid
        assertThat(match.players()).hasSize(6);
        assertThat(match.standings()).hasSize(6);
    }

    @Test
    void concurrentJoinsAndLeavesNeverViolateRoomCapacityOrCorruptRoster() throws Exception {
        int threadCount = 8;
        int iterations = 150;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);

        Match match = new Match("SEATS", new MatchConfig(3, 30, 10, 10_000, 6));

        List<Callable<Void>> tasks = new ArrayList<>();
        for (int i = 0; i < threadCount; i++) {
            final int threadId = i;
            tasks.add(() -> {
                startLatch.await(5, TimeUnit.SECONDS);
                for (int j = 0; j < iterations; j++) {
                    String playerId = "p-" + threadId + "-" + j;
                    String nickname = "User" + threadId + "_" + j;
                    try {
                        match.join(playerId, nickname);
                        match.markConnected(playerId, true, j * 50L);
                    } catch (IllegalStateException ignored) {
                        // Room full or name conflict
                    }

                    if (j % 3 == 0) {
                        match.leave(playerId, j * 50L);
                    }
                    assertThat(match.players().size()).isLessThanOrEqualTo(6);
                }
                return null;
            });
        }

        startLatch.countDown();
        List<Future<Void>> futures = executor.invokeAll(tasks);
        for (Future<Void> future : futures) {
            future.get(10, TimeUnit.SECONDS);
        }

        executor.shutdown();
        assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        assertThat(match.players().size()).isLessThanOrEqualTo(6);
    }

    @Test
    void concurrentBoardViewGenerationDuringRapidTrading() throws Exception {
        int threadCount = 8;
        int operations = 200;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);

        Match match = new Match("BOARD", new MatchConfig(3, 30, 10, 10_000, 8));
        for (int i = 0; i < 4; i++) {
            match.join("p-" + i, "Player-" + i);
            match.markConnected("p-" + i, true, 0);
        }
        match.start(0);

        List<Callable<Void>> tasks = new ArrayList<>();
        for (int i = 0; i < threadCount; i++) {
            final int threadId = i;
            tasks.add(() -> {
                startLatch.await(5, TimeUnit.SECONDS);
                for (int j = 0; j < operations; j++) {
                    long now = j * 100L;
                    String playerId = "p-" + (threadId % 4);

                    if (threadId % 2 == 0) {
                        try {
                            match.openPosition(playerId, Side.LONG, 0.5, 5, now);
                            match.closePosition(playerId, now + 50);
                        } catch (IllegalStateException | IllegalArgumentException ignored) {
                        }
                    } else {
                        for (PlayerSnapshot player : match.playerSnapshots(now)) {
                            if (player.inRound()) {
                                double eq = player.equity();
                                assertThat(eq).isGreaterThanOrEqualTo(0);
                            }
                        }
                    }
                }
                return null;
            });
        }

        startLatch.countDown();
        List<Future<Void>> futures = executor.invokeAll(tasks);
        for (Future<Void> future : futures) {
            future.get(10, TimeUnit.SECONDS);
        }

        executor.shutdown();
        assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
    }
}
