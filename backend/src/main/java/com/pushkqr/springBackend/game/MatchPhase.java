package com.pushkqr.springBackend.game;

public enum MatchPhase {
    /** Waiting for players. The host starts the match. */
    LOBBY,
    /**
     * The rules, before the first round. Ends when everyone has readied or the failsafe
     * expires, so a locked phone cannot hold the room shut.
     */
    BRIEFING,
    /**
     * Between rounds. Carries the results of the round just finished, the reveal of
     * whose rumor was a lie, and the next asset with each player's fresh rumor — so the
     * lying starts before the market opens.
     */
    INTERMISSION,
    TRADING,
    FINISHED
}
