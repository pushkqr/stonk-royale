package com.pushkqr.springBackend.game.info;

import com.pushkqr.springBackend.game.sim.Regime;

/**
 * A private tip handed to one player at round start.
 *
 * {@code truthful} is server-side only until the round ends — the whole mechanic depends
 * on players not knowing whether their own tip is real.
 */
public record Rumor(String text, Regime claimedRegime, boolean truthful) {
}
