package com.pushkqr.springBackend.game.model;

/**
 * A tradeable asset. Fictional by design: it keeps the game clear of anything that
 * could read as trading advice, and lets each ticker have a personality that a real
 * symbol never could.
 */
public record Asset(String ticker, String blurb, double basePrice) {
}
