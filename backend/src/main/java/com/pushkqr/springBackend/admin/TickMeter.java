package com.pushkqr.springBackend.admin;

import com.pushkqr.springBackend.game.model.MatchConfig;
import org.springframework.stereotype.Component;

import java.util.Arrays;

/**
 * How long a full pass over every live match is taking, against the budget it has.
 *
 * The engine advances every match on one thread every {@code STEP_MILLIS}, so a pass that
 * takes longer than that is not slow for one room — it is late for all of them, and it
 * arrives as the stutter a player reports as "it lagged for a bit". This is the
 * server-side half of {@link Telemetry}, which can only ever see one browser.
 *
 * The window is deliberately short: it answers "is it keeping up right now". Overruns are
 * counted separately, for the life of the process, because a burst half an hour ago is the
 * thing you most want to know about and a rolling window has already dropped it.
 *
 * Written by the scheduler thread and read by admin requests. Each field is written by
 * exactly one thread and read without a lock: a reader may see a value one pass stale,
 * which does not matter for a panel refreshed by hand, and no lock is worth taking on the
 * thread that owes every room a frame every hundred milliseconds.
 *
 * A bean of its own rather than a field on the engine: the view it feeds is built in
 * {@link Stats}, and the engine already depends on Stats — so hanging the meter off the
 * engine and injecting the engine into Stats would close a dependency cycle.
 */
@Component
public final class TickMeter {

    /** A pass has this long before it is late for every room at once. */
    private static final long BUDGET_MILLIS = MatchConfig.STEP_MILLIS;

    /** Ten passes a second, so this is the last minute. */
    private static final int WINDOW = 600;

    private final long[] window;
    private int next;
    private int filled;
    private long overruns;

    public TickMeter() {
        this(WINDOW);
    }

    /**
     * Package-private, for tests that need a window small enough to fill by hand. Spring
     * never sees it: with several constructors and none annotated, it takes the no-arg one.
     */
    TickMeter(int windowSize) {
        this.window = new long[windowSize];
    }

    public void record(long durationMillis) {
        window[next] = durationMillis;
        next = (next + 1) % window.length;
        if (filled < window.length) {
            filled++;
        }
        if (durationMillis > BUDGET_MILLIS) {
            overruns++;
        }
    }

    public long worstMillis() {
        long worst = 0;
        for (int i = 0; i < filled; i++) {
            worst = Math.max(worst, window[i]);
        }
        return worst;
    }

    public long medianMillis() {
        if (filled == 0) {
            return 0;
        }
        long[] sorted = Arrays.copyOf(window, filled);
        Arrays.sort(sorted);
        return sorted[filled / 2];
    }

    public long overruns() {
        return overruns;
    }

    public long budgetMillis() {
        return BUDGET_MILLIS;
    }
}
