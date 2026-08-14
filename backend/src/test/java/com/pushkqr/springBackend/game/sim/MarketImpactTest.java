package com.pushkqr.springBackend.game.sim;

import com.pushkqr.springBackend.game.model.Position;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * These assert the design targets from scratch/2026-08-14-order-flow-design.md, not just
 * that the code runs — the tuned constants (IMPACT_PER_TRADE, DECAY_TAU_SECONDS,
 * MAX_IMPACT) are private, so a test that wants a concrete number reconstructs it from the
 * documented target rather than reaching into the class.
 */
class MarketImpactTest {

    private static final double REFERENCE = 100_000;

    @Test
    void buyingPushesPriceUpAndSellingPushesItDown() {
        MarketImpact buy = new MarketImpact(0);
        buy.record(50_000, +1, REFERENCE, 0);
        assertTrue(buy.valueAt(0) > 0, "buying pressure must push impact positive");

        MarketImpact sell = new MarketImpact(0);
        sell.record(50_000, -1, REFERENCE, 0);
        assertTrue(sell.valueAt(0) < 0, "selling pressure must push impact negative");
    }

    @Test
    void aKickReadBackImmediatelyIsNotYetDecayed() {
        MarketImpact impact = new MarketImpact(0);
        // One player's largest possible trade against the reference: kick == IMPACT_PER_TRADE.
        impact.record(100_000, +1, REFERENCE, 1_000);
        assertEquals(0.015, impact.valueAt(1_000), 1e-9,
                "reading the value at the same instant it was recorded must show the raw kick");
    }

    @Test
    void impactFallsBelowTenPercentOfItsPeakWithinTenSeconds() {
        MarketImpact impact = new MarketImpact(0);
        impact.record(100_000, +1, REFERENCE, 0);
        double peak = impact.valueAt(0);

        assertTrue(impact.valueAt(10_000) <= 0.10 * peak,
                "a kick must have faded below 10% of its peak within 10s of no further trades");
    }

    @Test
    void repeatedKicksClampRatherThanRunningAway() {
        MarketImpact impact = new MarketImpact(0);
        // Twenty oversized buys, 100ms apart — far more one-sided flow than any real
        // match could produce, to prove the cap holds under sustained pressure.
        long now = 0;
        for (int i = 0; i < 20; i++) {
            impact.record(500_000, +1, REFERENCE, now);
            now += 100;
        }
        assertTrue(impact.valueAt(now) <= 0.04 + 1e-9,
                "impact must never exceed the documented 4% cap, however hard the room pushes");
    }

    @Test
    void aRoundTripHeldPastDecayCostsAboutTwiceOneKick() {
        // A representative half-stack 3x trade: notional = margin * leverage.
        double notional = 15_000;
        double kick = 0.015 * (notional / REFERENCE); // 0.00225 — 0.225%

        MarketImpact impact = new MarketImpact(0);
        impact.record(notional, +1, REFERENCE, 0);              // open long
        double entryMultiplier = 1 + impact.valueAt(0);

        long wellPastDecay = 20_000; // 5x the 4s decay window
        impact.record(notional, -1, REFERENCE, wellPastDecay);  // close long, held realistically
        double exitMultiplier = 1 + impact.valueAt(wellPastDecay);

        double roundTripCost = (exitMultiplier / entryMultiplier) - 1;
        assertEquals(-2 * kick, roundTripCost, kick * 0.05,
                "held past the decay window, a round trip should cost about twice one kick");
    }

    @Test
    void theImpactCapCanNeverAloneTriggerEvenMaxLeverageLiquidation() {
        // 10x liquidates on an adverse move of MAINTENANCE / MAX_LEVERAGE (9%). If the
        // impact cap ever crept up to or past that, a crowd doing nothing but talk could
        // wipe out a player who never got a bad regime — this must never be possible.
        double worstCaseLiquidationMove = Position.MAINTENANCE / Position.MAX_LEVERAGE;

        MarketImpact impact = new MarketImpact(0);
        long now = 0;
        for (int i = 0; i < 100; i++) {
            impact.record(1_000_000, -1, REFERENCE, now); // relentless, oversized selling
            now += 50;
        }
        assertTrue(Math.abs(impact.valueAt(now)) < worstCaseLiquidationMove,
                "the impact cap must stay under the smallest liquidation-triggering move at any leverage");
    }

    /**
     * The test above only proves one kick can't liquidate. It doesn't prove the thing that
     * actually matters for a held position: a position's entry price already has whatever
     * impact existed AT ENTRY baked into it, so the real exposure is the swing between that
     * entry-time impact and wherever impact is when the position is later checked — which,
     * if the room piles hard one way at entry and hard the other way afterward, can be up
     * to twice the cap, not just the cap once.
     */
    @Test
    void theFullSwingFromEntryToNowCanNeverAloneTriggerLiquidationEither() {
        double worstCaseLiquidationMove = Position.MAINTENANCE / Position.MAX_LEVERAGE;

        MarketImpact impact = new MarketImpact(0);
        // Push hard to the ceiling — this stands in for the impact a position's entry
        // price would have been filled against, in the worst case.
        long now = 0;
        for (int i = 0; i < 50; i++) {
            impact.record(1_000_000, +1, REFERENCE, now);
            now += 50;
        }
        double atEntry = impact.valueAt(now);

        // Then reverse hard to the floor — the room dumping after the position opened.
        for (int i = 0; i < 50; i++) {
            impact.record(1_000_000, -1, REFERENCE, now);
            now += 50;
        }
        double later = impact.valueAt(now);

        double fullSwing = Math.abs(later - atEntry);
        assertTrue(fullSwing < worstCaseLiquidationMove,
                "the total swing between a position's entry-time impact and any later read "
                + "must stay under the smallest liquidation-triggering move, since entry "
                + "price already embeds whatever impact existed when the position opened");
    }
}
