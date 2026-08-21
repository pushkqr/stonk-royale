package com.pushkqr.springBackend.game.model;

/**
 * A named rule variant for a whole match, chosen by the host in the lobby.
 *
 * The game has one shape: five rounds, a tip each, about half of them true. Eight assets and
 * five regimes mean a match burns five of the eight coins and two matches in an evening
 * exhausts the whole thing. Nothing is wrong with any single match — the problem is that the
 * second one is the first one again. These change how a match plays without adding content.
 *
 * Deliberately an enum and not a set of overridden numbers. A modifier has to be named to the
 * room on the lobby, in the briefing and on the trading floor, because a player who does not
 * know the rules changed is not playing a variant — they are playing the normal game badly.
 * The label and the blurb live here so those three screens cannot drift apart.
 */
public enum Modifier {

    NONE("Standard", "The normal game.", 1, false),

    /**
     * The tip count is normally drawn from a band around half the room, excluding both ends
     * by construction — see RoundPlanner.truthfulTipCount for why the ends ruin a round. This
     * is the excluded end, deliberately re-entered and announced: everyone is told that none
     * of the tips are real, so a tip stops naming what the market will do and starts naming
     * one thing it will not. Pool them honestly and the room can eliminate its way to the
     * truth, which is exactly what makes lying worth something.
     */
    ALL_LIES("All Lies", "Every tip in the room is false. The truth is what is left over.", 1, true),

    HIGH_ROLLER("High Roller", "Nothing under 5x. Somebody is getting liquidated.", 5, false);

    private final String label;
    private final String blurb;
    private final int minLeverage;
    private final boolean allTipsLie;

    Modifier(String label, String blurb, int minLeverage, boolean allTipsLie) {
        this.label = label;
        this.blurb = blurb;
        this.minLeverage = minLeverage;
        this.allTipsLie = allTipsLie;
    }

    /** The name the room is shown. Never {@code name()} — that is a wire constant. */
    public String label() {
        return label;
    }

    /** One sentence saying what changed, shown wherever the label is. */
    public String blurb() {
        return blurb;
    }

    /** The smallest position a player may open. 1 in every variant that does not care. */
    public int minLeverage() {
        return minLeverage;
    }

    /** Whether the round deals nobody a real tip. */
    public boolean allTipsLie() {
        return allTipsLie;
    }

    /**
     * Never throws and never returns null.
     *
     * The create endpoint is public and unauthenticated, so an unrecognised value has to mean
     * "the standard game" rather than a 500. Same for the absent case: every other setting on
     * that request is optional and falls back, and this is no different.
     */
    public static Modifier parse(String value) {
        if (value == null || value.isBlank()) {
            return NONE;
        }
        for (Modifier modifier : values()) {
            if (modifier.name().equalsIgnoreCase(value.trim())) {
                return modifier;
            }
        }
        return NONE;
    }
}
