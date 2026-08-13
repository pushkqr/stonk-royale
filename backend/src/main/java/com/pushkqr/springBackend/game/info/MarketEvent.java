package com.pushkqr.springBackend.game.info;

import com.pushkqr.springBackend.game.sim.Regime;

/**
 * A public headline broadcast to everyone mid-round.
 *
 * As with {@link Rumor}, {@code truthful} stays server-side until the round ends, so a
 * headline is evidence rather than proof.
 */
public record MarketEvent(long atMillis, String headline, Regime claimedRegime, boolean truthful) {
}
