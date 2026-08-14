package com.pushkqr.springBackend.game.bot;

import com.pushkqr.springBackend.game.model.Side;
import com.pushkqr.springBackend.game.sim.Regime;

/**
 * One thing a bot does at one moment, decided before the round starts.
 *
 * Sealed for the same reason {@code GameEvent} is: the tick loop switches over these
 * exhaustively, so a new kind of action cannot be added and silently ignored.
 */
public sealed interface BotAction {

    /** Milliseconds from the start of the phase this action belongs to. */
    long atMillis();

    String botId();

    record Open(long atMillis, String botId, Side side, double sizeFraction, int leverage)
            implements BotAction {
    }

    record Close(long atMillis, String botId) implements BotAction {
    }

    /**
     * @param claim the regime this bot is telling the room its tip named, or null for a
     *              line that goes on record about nothing
     */
    record Say(long atMillis, String botId, String text, Regime claim) implements BotAction {
    }
}
