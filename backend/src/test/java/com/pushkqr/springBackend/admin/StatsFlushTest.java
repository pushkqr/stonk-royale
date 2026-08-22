package com.pushkqr.springBackend.admin;

import com.pushkqr.springBackend.server.MatchRegistry;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The counters are written by a scheduled task and updated by the match engine, and until
 * this was fixed both happened inside the same monitor — so the game's clock waited on a
 * filesystem. The engine records a settled round and a liquidation on every match it ticks,
 * which is how a slow disk turned into a chart that stopped moving.
 */
class StatsFlushTest {

    /** A store whose write blocks until released, standing in for a filesystem under load. */
    private static final class BlockingStore extends StatsStore {
        private final CountDownLatch writing = new CountDownLatch(1);
        private final CountDownLatch release = new CountDownLatch(1);
        private final AtomicBoolean wrote = new AtomicBoolean();

        BlockingStore() {
            super(System.getProperty("java.io.tmpdir") + "/stonk-royale-flush-test.json");
        }

        @Override
        public void write(byte[] payload) {
            writing.countDown();
            try {
                release.await(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            wrote.set(true);
        }
    }

    @Test
    void aSlowDiskDoesNotStopTheEngineRecordingRounds() throws Exception {
        BlockingStore store = new BlockingStore();
        Stats stats = new Stats(new MatchRegistry(), store, new TickMeter());
        stats.roundPlayed();

        Thread flusher = new Thread(stats::flush, "flush");
        flusher.start();
        assertThat(store.writing.await(5, TimeUnit.SECONDS))
                .as("the flush must reach the write").isTrue();

        // The write is now in progress. The engine's thread has to get straight through.
        CountDownLatch recorded = new CountDownLatch(1);
        Thread engine = new Thread(() -> {
            stats.roundPlayed();
            stats.liquidated();
            recorded.countDown();
        }, "engine");
        engine.start();

        assertThat(recorded.await(2, TimeUnit.SECONDS))
                .as("recording a round must not wait on the disk").isTrue();

        store.release.countDown();
        flusher.join(5_000);
        engine.join(5_000);
        assertThat(store.wrote).isTrue();
    }

    @Test
    void aFlushWithNothingNewDoesNotTouchTheDiskTwice() {
        // A fresh Stats is already dirty: it stamps firstSeenEpochMillis when it loads. So
        // the thing worth pinning is that the SECOND flush writes nothing, which is the
        // batching this method exists for.
        CountingStore store = new CountingStore();
        Stats stats = new Stats(new MatchRegistry(), store, new TickMeter());

        stats.flush();
        int afterFirst = store.writes;
        stats.flush();

        assertThat(afterFirst).as("the first flush persists the stamp").isEqualTo(1);
        assertThat(store.writes).as("nothing changed in between, so nothing to write").isEqualTo(1);

        stats.roundPlayed();
        stats.flush();
        assertThat(store.writes).as("a recorded round makes it dirty again").isEqualTo(2);
    }

    private static final class CountingStore extends StatsStore {
        private int writes;

        CountingStore() {
            super(System.getProperty("java.io.tmpdir") + "/stonk-royale-count-test.json");
        }

        @Override
        public void write(byte[] payload) {
            writes++;
        }
    }
}
