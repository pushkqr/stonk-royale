package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.model.MatchConfig;

public final class Requests {

    private Requests() {
    }

    /**
     * Every setting is optional; anything omitted falls back to {@link MatchConfig#standard()}.
     *
     * @param deviceId a value the browser generated and keeps, used only to count how many
     *                 distinct people have played. Never used to identify anyone in game.
     */
    public record Create(String nickname, Integer rounds, Integer roundSeconds,
            Integer intermissionSeconds, Integer maxPlayers, Double startingCash,
            String deviceId) {
    }

    public record Join(String nickname, String deviceId) {
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
