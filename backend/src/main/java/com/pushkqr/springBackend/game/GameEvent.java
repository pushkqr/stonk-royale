package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.model.Side;
import com.pushkqr.springBackend.game.sim.Regime;

import java.util.List;

/**
 * Something worth telling the clients about, produced by {@link Match#tick(long)}.
 *
 * Returning events instead of broadcasting directly keeps {@code Match} free of Spring
 * and testable as plain logic.
 */
public sealed interface GameEvent {

    record PhaseChanged(MatchPhase phase, int roundIndex, long endsAtMillis) implements GameEvent {
    }

    record NewsBroken(String headline) implements GameEvent {
    }

    /**
     * The room's own trading has pushed the price hard enough to be worth telling
     * everyone. {@code roomIsBuying} is true for a net-buying push, false for net-selling.
     * Always true — unlike a headline, this is never a lie the server is telling.
     */
    record FlowSurge(boolean roomIsBuying) implements GameEvent {
    }

    record PlayerLiquidated(String playerId, String nickname, double marginLost) implements GameEvent {
    }

    record RoundSettled(int roundIndex, Regime regime, List<RoundResult> results) implements GameEvent {
    }

    /**
     * A bot took a position. Its own kind rather than a reuse of the human trade path,
     * because a bot has no socket and no session — {@code MatchSocketController} is where a
     * person's trade becomes a feed line, and nothing can call it on a bot's behalf.
     */
    record BotOpened(String playerId, String nickname, Side side, int leverage, double entryPrice)
            implements GameEvent {
    }

    record BotClosed(String playerId, String nickname, double pnl) implements GameEvent {
    }

    record BotSaid(String playerId, String nickname, String text) implements GameEvent {
    }

    /**
     * A seat was given up because its socket never came back.
     *
     * Its own event because the token behind it lives in Spring's SessionRegistry, which
     * {@code Match} deliberately cannot reach — the id has to travel out to something that
     * can drop it.
     */
    record SeatVacated(String playerId, String nickname) implements GameEvent {
    }
}
