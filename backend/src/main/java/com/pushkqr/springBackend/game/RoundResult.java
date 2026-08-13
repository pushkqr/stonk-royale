package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.sim.Regime;

/**
 * One player's outcome for one round, including the reveal of whether their tip was real.
 *
 * @param rumorClaimed what their tip actually said
 * @param claimedTipAs what they told the room it said, or null if they never said. The two
 *                     disagreeing is the only lie the server can prove.
 */
public record RoundResult(
        String playerId,
        String nickname,
        double roundScore,
        double totalScore,
        int liquidations,
        Regime rumorClaimed,
        boolean rumorWasTrue,
        Regime claimedTipAs) {
}
