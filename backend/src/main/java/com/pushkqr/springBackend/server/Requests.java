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

    public record Chat(String text) {
    }
}
