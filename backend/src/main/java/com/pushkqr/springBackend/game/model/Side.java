package com.pushkqr.springBackend.game.model;

public enum Side {
    LONG,
    SHORT;

    /** +1 for LONG, -1 for SHORT — lets PnL and liquidation share one formula. */
    public int direction() {
        return this == LONG ? 1 : -1;
    }
}
