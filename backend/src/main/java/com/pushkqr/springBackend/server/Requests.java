package com.pushkqr.springBackend.server;

public final class Requests {

    private Requests() {
    }

    /** rounds and roundSeconds are optional; both exist mainly to make playtesting fast. */
    public record Create(String nickname, Integer rounds, Integer roundSeconds) {
    }

    public record Join(String nickname) {
    }

    public record Open(String side, double sizeFraction, int leverage) {
    }

    public record Chat(String text) {
    }
}
