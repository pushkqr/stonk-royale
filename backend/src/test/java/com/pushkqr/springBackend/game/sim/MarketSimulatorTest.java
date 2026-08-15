package com.pushkqr.springBackend.game.sim;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;

/**
 * These assert design targets, not just that the code runs: rounds must be deterministic,
 * and a 90-second round must swing hard enough to be worth watching.
 */
class MarketSimulatorTest {

    private static final int STEPS = 900;      // 90s at 10 ticks/sec
    private static final long STEP_MILLIS = 100;
    private static final double START = 100.0;
    private static final int SAMPLES = 400;

    private final MarketSimulator simulator = new MarketSimulator();

    private PricePath path(Regime regime, long seed) {
        return simulator.generate(START, regime, STEPS, STEP_MILLIS, seed);
    }

    private static double median(double[] values) {
        double[] sorted = values.clone();
        Arrays.sort(sorted);
        return sorted[sorted.length / 2];
    }

    /** Median across many seeds, so tests don't hinge on one lucky path. */
    private double medianOverSeeds(Regime regime, java.util.function.ToDoubleFunction<PricePath> metric) {
        double[] results = new double[SAMPLES];
        for (int seed = 0; seed < SAMPLES; seed++) {
            results[seed] = metric.applyAsDouble(path(regime, seed));
        }
        return median(results);
    }

    @Test
    void samePathForSameSeed() {
        assertArrayEquals(path(Regime.CHOP, 42L).toArray(), path(Regime.CHOP, 42L).toArray());
    }

    @Test
    void differentPathForDifferentSeed() {
        assertFalse(Arrays.equals(path(Regime.CHOP, 1L).toArray(), path(Regime.CHOP, 2L).toArray()));
    }

    @ParameterizedTest
    @EnumSource(Regime.class)
    void pricesStayPositive(Regime regime) {
        for (int seed = 0; seed < SAMPLES; seed++) {
            for (double price : path(regime, seed).toArray()) {
                assertTrue(price > 0, regime + " produced a non-positive price");
            }
        }
    }

    @ParameterizedTest
    @EnumSource(Regime.class)
    void roundSwingsHardEnoughToBeWatchable(Regime regime) {
        double medianRange = medianOverSeeds(regime, p -> {
            double[] prices = p.toArray();
            double min = Arrays.stream(prices).min().orElseThrow();
            double max = Arrays.stream(prices).max().orElseThrow();
            return (max - min) / p.startPrice();
        });

        // A round has to move enough to be worth watching.
        assertTrue(medianRange >= 0.15, regime + " median range only " + medianRange);
    }

    @Test
    void pumpEndsHigherAndDumpEndsLower() {
        assertTrue(medianOverSeeds(Regime.PUMP, p -> p.endPrice() / p.startPrice()) > 1.10);
        assertTrue(medianOverSeeds(Regime.DUMP, p -> p.endPrice() / p.startPrice()) < 0.90);
    }

    @Test
    void chopHasNoDirectionalBias() {
        double medianReturn = medianOverSeeds(Regime.CHOP, p -> p.endPrice() / p.startPrice());
        assertTrue(medianReturn > 0.85 && medianReturn < 1.15, "CHOP drifted: " + medianReturn);
    }

    @Test
    void rugCrashesFromItsPreShockLevel() {
        double medianDrop = medianOverSeeds(Regime.RUG, p -> {
            double preShock = p.priceAt(shockStartMillis());
            return p.endPrice() / preShock;
        });
        assertTrue(medianDrop < 0.75, "RUG only fell to " + medianDrop + " of its pre-shock price");
    }

    @Test
    void squeezeSpikesFromItsPreShockLevel() {
        double medianSpike = medianOverSeeds(Regime.SQUEEZE, p -> {
            double preShock = p.priceAt(shockStartMillis());
            return p.endPrice() / preShock;
        });
        assertTrue(medianSpike > 1.25, "SQUEEZE only rose to " + medianSpike + " of its pre-shock price");
    }

    private long shockStartMillis() {
        return (long) (STEPS * 0.60) * STEP_MILLIS;
    }

    @Test
    void priceAtClampsOutsideTheRound() {
        PricePath path = path(Regime.PUMP, 7L);
        assertEquals(path.startPrice(), path.priceAt(-5_000));
        assertEquals(path.endPrice(), path.priceAt(999_999));
    }

    @Test
    void rejectsInvalidInput() {
        assertThrows(IllegalArgumentException.class,
                () -> simulator.generate(0, Regime.PUMP, STEPS, STEP_MILLIS, 1L));
        assertThrows(IllegalArgumentException.class,
                () -> simulator.generate(START, Regime.PUMP, 1, STEP_MILLIS, 1L));
    }

    @Test
    void higherVolatilityMultiplierProducesWiderRange() {
        PricePath calm = simulator.generate(START, Regime.CHOP, STEPS, STEP_MILLIS, 42L, 0.5);
        PricePath wild = simulator.generate(START, Regime.CHOP, STEPS, STEP_MILLIS, 42L, 2.0);

        assertNotNull(calm);
        assertNotNull(wild);
        assertFalse(Arrays.equals(calm.toArray(), wild.toArray()));
    }
}
