package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.model.MatchConfig;

public final class Requests {

    private Requests() {
    }

    /** Every setting is optional; anything omitted falls back to {@link MatchConfig#standard()}. */
    public record Create(String nickname, Integer rounds, Integer roundSeconds,
            Integer maxPlayers, Double startingCash) {
    }

    public record Join(String nickname) {
    }

    public record Open(String side, double sizeFraction, int leverage) {
    }

    /**
     * @param claim optional regime this line asserts the speaker's tip says. Quick-chat sends
     *              it; free text asserts nothing a server can read, and is left unscored.
     */
    public record Chat(String text, String claim) {
    }

    /** sameMarket replays the identical market, making the rematch a fair rerun. */
    public record Rematch(boolean sameMarket) {
    }
}
