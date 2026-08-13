package com.pushkqr.springBackend.game.info;

import com.pushkqr.springBackend.game.sim.Regime;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Random;

/**
 * Builds the round's information layer from the regime that was already chosen.
 *
 * Because the price path is precomputed, the server knows the round's future — which is
 * what lets a "true" rumor actually be true and lets a warning headline land before the
 * crash it warns about.
 */
public final class InformationScripter {

    /** Share of private rumors that describe the real regime. */
    public static final double TRUE_RUMOR_PROBABILITY = 0.40;

    /** Events land inside this window: late enough to matter, early enough to trade. */
    private static final double WINDOW_START = 0.15;
    private static final double WINDOW_END = 0.85;

    /** How far ahead of a shock its warning fires, giving players a reaction beat. */
    private static final long WARNING_LEAD_MIN_MILLIS = 2_000;
    private static final long WARNING_LEAD_SPREAD_MILLIS = 2_000;

    public Rumor rumorFor(Regime actual, String ticker, Random random) {
        if (random.nextDouble() < TRUE_RUMOR_PROBABILITY) {
            return truthfulRumorFor(actual, ticker, random);
        }
        Regime claimed = otherThan(actual, random);
        return new Rumor(NewsCopy.rumor(claimed, ticker, random), claimed, false);
    }

    /** Lets the planner guarantee a round holds at least one real tip. */
    public Rumor truthfulRumorFor(Regime actual, String ticker, Random random) {
        return new Rumor(NewsCopy.rumor(actual, ticker, random), actual, true);
    }

    /**
     * Exactly two headlines per round — one truthful, one not — so a headline appearing
     * is never itself information. For shock regimes the truthful one is pinned just
     * ahead of the shock; otherwise it lands anywhere in the window, same as the lie.
     */
    public List<MarketEvent> eventsFor(Regime actual, String ticker, long roundMillis, Random random) {
        List<MarketEvent> events = new ArrayList<>(2);

        events.add(new MarketEvent(
                truthfulEventTime(actual, roundMillis, random),
                NewsCopy.headline(actual, ticker, random),
                actual,
                true));

        Regime lie = otherThan(actual, random);
        events.add(new MarketEvent(
                randomTimeInWindow(roundMillis, random),
                NewsCopy.headline(lie, ticker, random),
                lie,
                false));

        events.sort(Comparator.comparingLong(MarketEvent::atMillis));
        return List.copyOf(events);
    }

    private long truthfulEventTime(Regime actual, long roundMillis, Random random) {
        Regime.Shock shock = actual.shock();
        if (shock == null) {
            return randomTimeInWindow(roundMillis, random);
        }
        long shockStart = (long) (roundMillis * shock.startFraction());
        long lead = WARNING_LEAD_MIN_MILLIS + (long) (random.nextDouble() * WARNING_LEAD_SPREAD_MILLIS);
        return shockStart - lead;
    }

    private long randomTimeInWindow(long roundMillis, Random random) {
        double fraction = WINDOW_START + random.nextDouble() * (WINDOW_END - WINDOW_START);
        return (long) (roundMillis * fraction);
    }

    private Regime otherThan(Regime actual, Random random) {
        Regime[] all = Regime.values();
        Regime picked;
        do {
            picked = all[random.nextInt(all.length)];
        } while (picked == actual);
        return picked;
    }
}
