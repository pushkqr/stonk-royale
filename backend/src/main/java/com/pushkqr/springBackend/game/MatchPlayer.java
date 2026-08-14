package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.model.PlayerRound;

import java.util.ArrayList;
import java.util.List;

public final class MatchPlayer {

    private final String id;
    private final String nickname;
    private final List<Double> roundScores = new ArrayList<>();

    /** Not final: the badge moves if the host leaves, so the room stays startable. */
    private boolean host;

    /**
     * Whether this player's socket is currently up. Starts true — a seat is only ever
     * created by a join that is about to open one.
     */
    private boolean connected = true;

    private PlayerRound round;

    /**
     * Whether this seat is filled by a scripted opponent rather than a person.
     *
     * Bots are real players in every way that matters to the market — they hold positions,
     * move the price and place in the standings — so almost nothing branches on this. It
     * exists for the three places where treating a bot as a person is actively wrong:
     * reaping an abandoned room, opening the briefing gate, and counting who is online.
     */
    private final boolean bot;

    public MatchPlayer(String id, String nickname, boolean host) {
        this(id, nickname, host, false);
    }

    MatchPlayer(String id, String nickname, boolean host, boolean bot) {
        this.id = id;
        this.nickname = nickname;
        this.host = host;
        this.bot = bot;
    }

    public boolean isBot() {
        return bot;
    }

    public String id() {
        return id;
    }

    public String nickname() {
        return nickname;
    }

    public boolean isHost() {
        return host;
    }

    void promoteToHost() {
        host = true;
    }

    public boolean isConnected() {
        return connected;
    }

    void setConnected(boolean value) {
        connected = value;
    }

    /** Current round state, or null outside a round. */
    public PlayerRound round() {
        return round;
    }

    void beginRound(double startingCash) {
        round = new PlayerRound(startingCash);
    }

    void recordRoundScore(double score) {
        roundScores.add(score);
        round = null;
    }

    /** Clears scores for a fresh match while keeping the seat, so nobody has to rejoin. */
    void resetForRematch() {
        roundScores.clear();
        round = null;
    }

    public List<Double> roundScores() {
        return List.copyOf(roundScores);
    }

    public double totalScore() {
        return roundScores.stream().mapToDouble(Double::doubleValue).sum();
    }

    /** Tie-break when two players finish on the same total. */
    public double bestRound() {
        return roundScores.stream().mapToDouble(Double::doubleValue).max().orElse(0);
    }
}
