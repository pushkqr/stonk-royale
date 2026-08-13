package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.model.PlayerRound;

import java.util.ArrayList;
import java.util.List;

public final class MatchPlayer {

    private final String id;
    private final String nickname;
    private final boolean host;
    private final List<Double> roundScores = new ArrayList<>();

    private PlayerRound round;

    public MatchPlayer(String id, String nickname, boolean host) {
        this.id = id;
        this.nickname = nickname;
        this.host = host;
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
