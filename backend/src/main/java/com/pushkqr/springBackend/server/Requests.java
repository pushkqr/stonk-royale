package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.model.MatchConfig;

public final class Requests {

    private Requests() {
    }

    /**
     * Every setting is optional; anything omitted falls back to {@link MatchConfig#standard()}.
     *
     * @param deviceId a value the browser generated and keeps. It identifies a guest across
     *                 requests, which is what lets somebody who lost their tab be given
     *                 their own seat back, and it counts distinct players for the admin
     *                 stats. It authorises nothing — the session token does that.
     * @param isPublic whether quick match may put strangers in this room. Null means no.
     */
    public record Create(String nickname, Integer rounds, Integer roundSeconds,
            Integer intermissionSeconds, Integer maxPlayers, Double startingCash,
            String deviceId, Boolean isPublic, Double volatilityMultiplier,
            Double marketImpactMultiplier, String avatar, String modifier) {
        public Create(String nickname, Integer rounds, Integer roundSeconds,
                Integer intermissionSeconds, Integer maxPlayers, Double startingCash,
                String deviceId, Boolean isPublic, Double volatilityMultiplier,
                Double marketImpactMultiplier, String avatar) {
            this(nickname, rounds, roundSeconds, intermissionSeconds, maxPlayers, startingCash,
                    deviceId, isPublic, volatilityMultiplier, marketImpactMultiplier, avatar, null);
        }
        public Create(String nickname, Integer rounds, Integer roundSeconds,
                Integer intermissionSeconds, Integer maxPlayers, Double startingCash,
                String deviceId, Boolean isPublic, Double volatilityMultiplier,
                Double marketImpactMultiplier) {
            this(nickname, rounds, roundSeconds, intermissionSeconds, maxPlayers, startingCash, deviceId, isPublic, volatilityMultiplier, marketImpactMultiplier, null);
        }

        public Create(String nickname, Integer rounds, Integer roundSeconds,
                Integer intermissionSeconds, Integer maxPlayers, Double startingCash,
                String deviceId, Boolean isPublic, Double volatilityMultiplier) {
            this(nickname, rounds, roundSeconds, intermissionSeconds, maxPlayers, startingCash, deviceId, isPublic, volatilityMultiplier, 1.0, null);
        }

        public Create(String nickname, Integer rounds, Integer roundSeconds,
                Integer intermissionSeconds, Integer maxPlayers, Double startingCash,
                String deviceId, Boolean isPublic) {
            this(nickname, rounds, roundSeconds, intermissionSeconds, maxPlayers, startingCash, deviceId, isPublic, 1.0, 1.0, null);
        }
    }

    public record Join(String nickname, String deviceId, Boolean skipBriefing, String avatar) {
        public Join(String nickname, String deviceId, Boolean skipBriefing) {
            this(nickname, deviceId, skipBriefing, null);
        }

        public Join(String nickname, String deviceId) {
            this(nickname, deviceId, false, null);
        }
    }

    /** Lobby-only. The client sends the id it has stored; unknown values fall back. */
    public record Avatar(String avatar) {
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
            double startingCash, int maxPlayers, boolean isPublic, Double volatilityMultiplier,
            Double marketImpactMultiplier, String modifier) {
        public Config(int rounds, int roundSeconds, int intermissionSeconds,
                double startingCash, int maxPlayers, boolean isPublic, Double volatilityMultiplier,
                Double marketImpactMultiplier) {
            this(rounds, roundSeconds, intermissionSeconds, startingCash, maxPlayers, isPublic,
                    volatilityMultiplier, marketImpactMultiplier, null);
        }

        public Config(int rounds, int roundSeconds, int intermissionSeconds,
                double startingCash, int maxPlayers, boolean isPublic, Double volatilityMultiplier) {
            this(rounds, roundSeconds, intermissionSeconds, startingCash, maxPlayers, isPublic, volatilityMultiplier, 1.0, null);
        }

        public Config(int rounds, int roundSeconds, int intermissionSeconds,
                double startingCash, int maxPlayers, boolean isPublic) {
            this(rounds, roundSeconds, intermissionSeconds, startingCash, maxPlayers, isPublic, 1.0, 1.0, null);
        }
    }
}
