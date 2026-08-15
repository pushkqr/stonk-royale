package com.pushkqr.springBackend.game.model;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PlayerRoundTest {

    private static final double TOL = 1e-9;
    private static final double CASH = 10_000;

    private PlayerRound round() {
        return new PlayerRound(CASH);
    }

    @Test
    void startsFlatAtZeroScore() {
        PlayerRound r = round();

        assertEquals(CASH, r.cash(), TOL);
        assertEquals(CASH, r.equity(123.45), TOL);
        assertEquals(0, r.scoreAt(123.45), TOL);
        assertFalse(r.hasPosition());
    }

    @Test
    void winningLongBooksProfitAndScore() {
        PlayerRound r = round();
        r.open(Side.LONG, 0.5, 4, 100, 0);   // $5,000 margin at 4x = $20,000 notional

        assertEquals(CASH + 2000, r.equity(110), TOL);   // +10% price on $20k notional
        assertEquals(20.0, r.scoreAt(110), TOL);

        assertEquals(2000, r.close(110), TOL);
        assertEquals(12_000, r.cash(), TOL);
        assertFalse(r.hasPosition());
    }

    @Test
    void winningShortBooksProfit() {
        PlayerRound r = round();
        r.open(Side.SHORT, 1.0, 2, 100, 0);  // $10,000 margin at 2x = $20,000 notional

        assertEquals(4000, r.close(80), TOL);   // -20% price
        assertEquals(14_000, r.cash(), TOL);
    }

    @Test
    void liquidationCostsExactlyMaintenanceMargin() {
        PlayerRound r = round();
        r.open(Side.LONG, 1.0, 10, 100, 0);   // $10,000 margin, liquidates at 91

        assertFalse(r.liquidateIfBreached(92), "still alive above the liquidation price");
        assertTrue(r.liquidateIfBreached(90));

        // Loses 90% of the $10,000 margin, keeping the remaining 10%.
        assertEquals(1000, r.cash(), TOL);
        assertEquals(1, r.liquidations());
        assertFalse(r.hasPosition());
    }

    @Test
    void liquidationIsIdempotentOnceClosed() {
        PlayerRound r = round();
        r.open(Side.LONG, 1.0, 10, 100, 0);

        assertTrue(r.liquidateIfBreached(50));
        assertFalse(r.liquidateIfBreached(50), "no position left to liquidate");
        assertEquals(1, r.liquidations());
    }

    @Test
    void canTradeAgainAfterLiquidation() {
        PlayerRound r = round();
        r.open(Side.LONG, 1.0, 10, 100, 0);
        r.liquidateIfBreached(90);
        assertEquals(1000, r.cash(), TOL);

        // Comeback attempt on the surviving 10%.
        r.open(Side.SHORT, 1.0, 10, 90, 0);
        r.close(81);   // -10% price on $10,000 notional
        assertEquals(2000, r.cash(), TOL);
        assertEquals(-80.0, r.scoreAt(81), TOL);
    }

    @Test
    void sizingScalesRiskAgainstRemainingCash() {
        PlayerRound r = round();
        r.open(Side.LONG, 0.25, 2, 100, 0);   // $2,500 margin at 2x = $5,000 notional

        assertEquals(2500, r.position().margin(), TOL);
        assertEquals(5000, r.position().notional(), TOL);
    }

    @Test
    void onlyOnePositionAtATime() {
        PlayerRound r = round();
        r.open(Side.LONG, 0.5, 2, 100, 0);

        assertThrows(IllegalStateException.class, () -> r.open(Side.SHORT, 0.5, 2, 100, 0));
    }

    @Test
    void rejectsClosingNothing() {
        assertThrows(IllegalStateException.class, () -> round().close(100));
    }

    @Test
    void rejectsInvalidSizing() {
        assertThrows(IllegalArgumentException.class, () -> round().open(Side.LONG, 0, 2, 100, 0));
        assertThrows(IllegalArgumentException.class, () -> round().open(Side.LONG, 1.5, 2, 100, 0));
    }

    @Test
    void clampsUnrealisedLossAtMaintenanceMargin() {
        // A short's loss is clamped to maintenance margin even if closed at an extreme price
        // without a liquidation check ever running. Cash never goes negative.
        PlayerRound r = round();
        r.open(Side.SHORT, 1.0, 1, 100, 0);
        r.close(250);   // 100 units against a +150 move clamped to -90% of margin

        assertEquals(1000, r.cash(), TOL);
    }
}
