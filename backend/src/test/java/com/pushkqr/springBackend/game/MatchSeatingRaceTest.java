package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.model.MatchConfig;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MatchSeatingRaceTest {

    private static final List<String> NAMES = List.of("Vega", "Kite", "Moss", "Pike", "Otto");

    @Test
    void concurrentBotSeatingNeverHandsOutTheSameName() throws Exception {
        int rounds = 50;
        int threads = 12;
        ExecutorService executor = Executors.newFixedThreadPool(threads);

        try {
            for (int round = 0; round < rounds; round++) {
                Match match = new Match("RACE" + round, MatchConfig.standard());
                CountDownLatch startLatch = new CountDownLatch(1);
                List<Callable<Void>> tasks = new ArrayList<>();

                for (int i = 0; i < threads; i++) {
                    tasks.add(() -> {
                        startLatch.await(5, TimeUnit.SECONDS);
                        try {
                            match.seatBot(NAMES);
                        } catch (IllegalStateException ignored) {
                            // Expected once the room is full or all candidate names are taken
                        }
                        return null;
                    });
                }

                startLatch.countDown();
                List<Future<Void>> futures = executor.invokeAll(tasks);
                for (Future<Void> future : futures) {
                    future.get(10, TimeUnit.SECONDS);
                }

                List<PlayerSnapshot> snapshots = match.playerSnapshots(0);
                List<String> seatedBotNames = snapshots.stream()
                        .filter(PlayerSnapshot::bot)
                        .map(PlayerSnapshot::nickname)
                        .toList();

                assertThat(seatedBotNames).doesNotHaveDuplicates();
                assertThat(seatedBotNames.size()).isLessThanOrEqualTo(NAMES.size());
            }
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void avatarChangesAreVisibleInTheNextSnapshot() {
        Match match = new Match("AVTR", MatchConfig.standard());
        match.seat("p1", "Alice", "banker");

        assertThat(match.playerSnapshots(0))
                .filteredOn(p -> p.id().equals("p1"))
                .extracting(PlayerSnapshot::avatar)
                .containsExactly("banker");

        boolean updated = match.setAvatar("p1", "whale");
        assertTrue(updated);

        assertThat(match.playerSnapshots(0))
                .filteredOn(p -> p.id().equals("p1"))
                .extracting(PlayerSnapshot::avatar)
                .containsExactly("whale");

        boolean missing = match.setAvatar("nonexistent", "degen");
        assertFalse(missing);
    }
}
