package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.MatchPlayer;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Opponent bot seating and naming.
 */
public final class Bots {

    /** Deliberately unremarkable names — a bot should read as another player, not a robot. */
    public static final List<String> NAMES = List.of("Vega", "Kite", "Moss", "Pike", "Otto");

    public static final int BOT_COUNT = 3;

    private Bots() {
    }

    /**
     * Seats one bot, with an id and a name nobody in the room is already using.
     *
     * The name check is against everybody present, humans and bots alike: the host can add
     * these one at a time on top of whatever quick match already seated, so "the next name
     * in the list" is not good enough on its own.
     *
     * Ids are scanned for the first free slot rather than counted, because a host can add a
     * bot, kick it, and add another — a counter would hand out an id that is already taken.
     */
    public static MatchPlayer seat(Match match) {
        if (match.players().size() >= match.config().maxPlayers()) {
            throw new IllegalStateException("Match is full");
        }

        Set<String> takenNames = match.players().stream()
                .map(player -> player.nickname().toLowerCase())
                .collect(Collectors.toSet());

        String name = NAMES.stream()
                .filter(n -> !takenNames.contains(n.toLowerCase()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No more bot names available"));

        Set<String> takenIds = match.players().stream()
                .map(MatchPlayer::id)
                .collect(Collectors.toSet());

        String id = null;
        for (int i = 0; i < 1000; i++) {
            String candidate = "bot:" + i;
            if (!takenIds.contains(candidate)) {
                id = candidate;
                break;
            }
        }
        return match.addBot(id, name);
    }

    public static void fill(Match match, int count) {
        for (int i = 0; i < count; i++) {
            seat(match);
        }
    }
}
