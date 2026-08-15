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
     * Whether this player's socket is currently up.
     *
     * Starts false, because a seat is created over HTTP and the socket opens afterwards.
     * It used to start true on the assumption the two were the same moment — which made a
     * visitor who took a code and closed the tab indistinguishable from one who is sitting
     * in the room, and left the match unreapable forever.
     */
    private boolean connected;

    /**
     * When this player's socket went away, or 0 while it is up.
     *
     * A seat is not freed the instant a socket drops — a refresh, a tunnel or a wifi
     * handover all look identical to a closed tab from here, and treating them the same is
     * what used to throw people out of the lobby for reloading the page.
     */
    private long disconnectedSinceMillis;

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

    /**
     * @param atMillis when this happened, so a grace period can be measured from it
     */
    void setConnected(boolean value, long atMillis) {
        if (value) {
            disconnectedSinceMillis = 0;
        } else if (disconnectedSinceMillis == 0) {
            // Started once and never pushed out: a repeated disconnect notification must not
            // extend the deadline, or a seat that keeps being re-noticed is never given up.
            //
            // Keyed on the clock rather than on the previous state, so that a seat which was
            // never connected in the first place still gets one. A code taken over HTTP whose
            // socket never opens has no transition to trigger on, and without a clock it
            // would be held for the life of the process.
            disconnectedSinceMillis = atMillis;
        }
        connected = value;
    }

    /** When this player's socket went away, or 0 while it is up. */
    public long disconnectedSinceMillis() {
        return disconnectedSinceMillis;
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
