package com.pushkqr.springBackend.game.model;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PositionTest {

    private static final double TOL = 1e-9;

    @Test
    void longGainsWhenPriceRises() {
        // $1,000 margin at 5x = $5,000 notional = 50 units at $100.
        Position p = new Position(Side.LONG, 1000, 5, 100, 0);

        assertEquals(5000, p.notional(), TOL);
        assertEquals(50, p.units(), TOL);
        assertEquals(500, p.unrealisedPnl(110), TOL);   // +10% price = +50% on margin
        assertEquals(-500, p.unrealisedPnl(90), TOL);
    }

    @Test
    void shortGainsWhenPriceFalls() {
        Position p = new Position(Side.SHORT, 1000, 5, 100, 0);

        assertEquals(500, p.unrealisedPnl(90), TOL);
        assertEquals(-500, p.unrealisedPnl(110), TOL);
    }

    @Test
    void liquidationPriceIsWhereMaintenanceIsBreached() {
        Position longPos = new Position(Side.LONG, 1000, 10, 100, 0);
        // 10x liquidates on a 9% adverse move.
        assertEquals(91.0, longPos.liquidationPrice(), TOL);

        Position shortPos = new Position(Side.SHORT, 1000, 10, 100, 0);
        assertEquals(109.0, shortPos.liquidationPrice(), TOL);
    }

    @Test
    void isLiquidatedFlipsExactlyAtTheLiquidationPrice() {
        Position p = new Position(Side.LONG, 1000, 5, 100, 0);
        double liq = p.liquidationPrice();

        assertTrue(p.isLiquidatedAt(liq), "should liquidate at the threshold");
        assertTrue(p.isLiquidatedAt(liq - 0.01));
        assertFalse(p.isLiquidatedAt(liq + 0.01));
    }

    @Test
    void higherLeverageLiquidatesSooner() {
        double entry = 100;
        double lowLev = new Position(Side.LONG, 1000, 2, entry, 0).liquidationPrice();
        double highLev = new Position(Side.LONG, 1000, 10, entry, 0).liquidationPrice();

        assertTrue(highLev > lowLev, "10x should die closer to entry than 2x");
        assertEquals(55.0, lowLev, TOL);   // 2x -> 45% adverse move
        assertEquals(91.0, highLev, TOL);  // 10x -> 9% adverse move
    }

    @Test
    void rejectsInvalidTerms() {
        assertThrows(IllegalArgumentException.class, () -> new Position(Side.LONG, 0, 5, 100, 0));
        assertThrows(IllegalArgumentException.class, () -> new Position(Side.LONG, 1000, 0, 100, 0));
        assertThrows(IllegalArgumentException.class, () -> new Position(Side.LONG, 1000, 11, 100, 0));
        assertThrows(IllegalArgumentException.class, () -> new Position(Side.LONG, 1000, 5, 0, 0));
    }
}
