package com.pushkqr.springBackend.admin;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TickMeterTest {

    @Test
    void anEmptyMeterReportsNothingRatherThanZeroSamples() {
        TickMeter meter = new TickMeter(4);

        assertThat(meter.worstMillis()).isZero();
        assertThat(meter.medianMillis()).isZero();
        assertThat(meter.overruns()).isZero();
    }

    @Test
    void itReportsTheWorstAndTheMiddleOfTheWindow() {
        TickMeter meter = new TickMeter(4);
        meter.record(2);
        meter.record(10);
        meter.record(4);
        meter.record(6);

        assertThat(meter.worstMillis()).isEqualTo(10);
        assertThat(meter.medianMillis()).isEqualTo(6);
    }

    @Test
    void theWindowForgetsPassesOlderThanItsSize() {
        TickMeter meter = new TickMeter(2);
        meter.record(500);
        meter.record(1);
        meter.record(1);

        // The 500 has been overwritten, so it must no longer dominate the worst case —
        // otherwise the panel reports a stall from an hour ago as if it were happening now.
        assertThat(meter.worstMillis()).isEqualTo(1);
    }

    @Test
    void overrunsOutliveTheWindowTheyHappenedIn() {
        TickMeter meter = new TickMeter(2);
        meter.record(meter.budgetMillis() + 1);
        meter.record(1);
        meter.record(1);

        // Deliberately counted for the life of the process: a burst of overruns an hour
        // ago is exactly what you want to know about, and the rolling window has by now
        // forgotten it entirely.
        assertThat(meter.overruns()).isEqualTo(1);
    }

    @Test
    void aPassExactlyOnBudgetIsNotAnOverrun() {
        TickMeter meter = new TickMeter(2);
        meter.record(meter.budgetMillis());

        assertThat(meter.overruns()).isZero();
    }
}
