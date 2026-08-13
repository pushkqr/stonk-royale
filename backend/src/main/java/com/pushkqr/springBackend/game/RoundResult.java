package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.sim.Regime;

/** One player's outcome for one round, including the reveal of whether their tip was real. */
public record RoundResult(
        String playerId,
        String nickname,
        double roundScore,
        double totalScore,
        int liquidations,
        Regime rumorClaimed,
        boolean rumorWasTrue) {
}
