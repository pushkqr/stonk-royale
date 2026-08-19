package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.Match;

import java.util.List;

/**
 * Opponent bot seating and naming.
 */
public final class Bots {

    /** Deliberately unremarkable names — a bot should read as another player, not a robot. */
    public static final List<String> NAMES = List.of("Vega", "Kite", "Moss", "Pike", "Otto");

    public static final int BOT_COUNT = 3;

    private Bots() {
    }

    public static void seat(Match match) {
        match.seatBot(NAMES);
    }

    public static void fill(Match match, int count) {
        for (int i = 0; i < count; i++) {
            seat(match);
        }
    }
}
