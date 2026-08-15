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
     * @param isPublic whether quick match may put strangers in this room. Null means no.
     */
    public record Create(String nickname, Integer rounds, Integer roundSeconds,
            Integer intermissionSeconds, Integer maxPlayers, Double startingCash,
            String deviceId, Boolean isPublic, Double volatilityMultiplier) {
        public Create(String nickname, Integer rounds, Integer roundSeconds,
                Integer intermissionSeconds, Integer maxPlayers, Double startingCash,
                String deviceId, Boolean isPublic) {
            this(nickname, rounds, roundSeconds, intermissionSeconds, maxPlayers, startingCash, deviceId, isPublic, 1.0);
        }
    }

    public record Join(String nickname, String deviceId, Boolean skipBriefing) {
        public Join(String nickname, String deviceId) {
            this(nickname, deviceId, false);
        }
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

    /** Host-only, lobby-only. Frees the seat; the room code still works, so it is not a ban. */
    public record Kick(String playerId) {
    }

    /** Host-only, lobby-only retune. All values are required — the client sends the full set. */
    public record Config(int rounds, int roundSeconds, int intermissionSeconds,
            double startingCash, int maxPlayers, boolean isPublic, Double volatilityMultiplier) {
        public Config(int rounds, int roundSeconds, int intermissionSeconds,
                double startingCash, int maxPlayers, boolean isPublic) {
            this(rounds, roundSeconds, intermissionSeconds, startingCash, maxPlayers, isPublic, 1.0);
        }
    }
}
