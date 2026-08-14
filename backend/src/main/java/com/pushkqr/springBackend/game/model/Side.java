package com.pushkqr.springBackend.game.model;

public enum Side {
    LONG,
    SHORT;

    /** +1 for LONG, -1 for SHORT — lets PnL and liquidation share one formula. */
    public int direction() {
        return this == LONG ? 1 : -1;
    }

    /** The other side of the same trade, which is what a closing kick pushes. */
    public Side opposite() {
        return this == LONG ? SHORT : LONG;
    }
}
