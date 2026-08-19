package com.pushkqr.springBackend.game;

import java.util.List;

/** The nine marks a player can wear. Mirrors ARCHETYPES in frontend/src/lib/avatars.js. */
public final class Avatars {

    public static final List<String> IDS = List.of(
            "banker", "ape", "moon", "insider", "quant", "bull", "bear", "degen", "whale");

    public static final String DEFAULT = "banker";

    private Avatars() {
    }

    /** Null, blank or unrecognised all fall back — a client may send anything. */
    public static String sanitise(String id) {
        return id != null && IDS.contains(id) ? id : DEFAULT;
    }

    /** Deterministic pick for seats that never chose one, i.e. bots. */
    public static String forSeed(String seed) {
        return IDS.get(Math.floorMod(seed == null ? 0 : seed.hashCode(), IDS.size()));
    }
}
