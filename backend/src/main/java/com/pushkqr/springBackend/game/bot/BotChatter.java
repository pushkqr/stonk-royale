package com.pushkqr.springBackend.game.bot;

import com.pushkqr.springBackend.game.GameEvent;

import java.util.List;

/**
 * The noise bots make about things that just happened.
 *
 * A script alone is not enough: a bot working purely from a timeline will brag through its
 * own liquidation, and a room that does not notice a crash reads as a recording rather than
 * as people. This is the smallest fix — a fixed line per kind of event, no state beyond a
 * rotating cursor, and no RNG, so the same round always produces the same talk.
 */
public final class BotChatter {

    /** Long enough that a cascade of liquidations is a reaction, not a wall of text. */
    private static final long COOLDOWN_MILLIS = 4_000;

    private static final List<String> ON_NEWS = List.of("seen it", "that changes things", "hm");
    private static final List<String> ON_SURGE_UP = List.of("here we go", "everyone's long", "too late?");
    private static final List<String> ON_SURGE_DOWN = List.of("get out", "it's going", "told you");
    private static final List<String> ON_LIQUIDATION = List.of("oof", "called it", "brutal");

    private long lastAtMillis = Long.MIN_VALUE;
    private int cursor;

    /**
     * One bot's reaction to something that just happened, or null for nothing to say.
     *
     * @param subjectId the player the event is about, who must not react to themselves, or
     *                  null when the event is about nobody
     */
    public Reaction reactTo(GameEvent event, List<String> botIds, String subjectId, long now) {
        List<String> lines = linesFor(event);
        if (lines == null || botIds.isEmpty() || now < lastAtMillis + COOLDOWN_MILLIS) {
            return null;
        }

        List<String> eligible = botIds.stream().filter(id -> !id.equals(subjectId)).toList();
        if (eligible.isEmpty()) {
            return null;
        }

        String botId = eligible.get(Math.floorMod(cursor, eligible.size()));
        String line = lines.get(Math.floorMod(cursor, lines.size()));
        cursor++;
        lastAtMillis = now;
        return new Reaction(botId, line);
    }

    /** Null for anything bots have no opinion about — including their own chatter. */
    private List<String> linesFor(GameEvent event) {
        return switch (event) {
            case GameEvent.NewsBroken ignored -> ON_NEWS;
            case GameEvent.FlowSurge surge -> surge.roomIsBuying() ? ON_SURGE_UP : ON_SURGE_DOWN;
            case GameEvent.PlayerLiquidated ignored -> ON_LIQUIDATION;
            default -> null;
        };
    }

    public record Reaction(String botId, String text) {
    }
}
