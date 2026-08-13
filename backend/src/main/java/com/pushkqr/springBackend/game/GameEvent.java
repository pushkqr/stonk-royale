package com.pushkqr.springBackend.game;

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

    record PlayerLiquidated(String playerId, String nickname, double marginLost) implements GameEvent {
    }

    record RoundSettled(int roundIndex, Regime regime, List<RoundResult> results) implements GameEvent {
    }
}
