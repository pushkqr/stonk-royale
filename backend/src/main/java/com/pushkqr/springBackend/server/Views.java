package com.pushkqr.springBackend.server;

import java.util.List;

/**
 * Everything sent over the wire.
 *
 * Kept apart from the game model on purpose: a {@code Rumor} carries whether it is
 * truthful, and a {@code RoundPlan} carries the entire future price path. Neither may
 * reach a client mid-round, so the client only ever sees these deliberately narrower shapes.
 */
public final class Views {

    private Views() {
    }

    public record Asset(String ticker, String blurb, double startPrice) {
    }

    /**
     * @param serverTime   lets the client run its countdown against the server clock rather
     *                     than trusting its own, which can be minutes out.
     * @param truthfulTips how many players hold a true tip this round, or null when there is
     *                     no round or too few players for the count to keep a secret.
     */
    public record Phase(String phase, int roundIndex, int totalRounds, long endsAtMillis,
            long serverTime, Asset asset, Integer truthfulTips) {
    }

    /** How far the briefing has got. Its own shape so a click never re-sends a phase. */
    public record Ready(int ready, int total) {
    }

    public record Price(double price, long elapsedMillis) {
    }

    public record Position(String side, double margin, int leverage, double entryPrice,
            double liquidationPrice, double unrealisedPnl) {
    }

    public record BoardRow(String playerId, String nickname, double equity, double roundScore,
            double totalScore, Position position) {
    }

    /** kind is one of NEWS, LIQUIDATION, TRADE, CHAT, FLOW. */
    public record Feed(String kind, String text, String playerId, String nickname) {
    }

    /**
     * The private tip. Truthfulness is withheld until the round settles.
     *
     * {@code claimedRegime} is the regime the tip asserts, as a {@code Regime} name. It is
     * already readable off the text, so naming it leaks nothing — it saves the player
     * decoding flavour prose into a trading stance while the market moves.
     */
    public record Rumor(String text, String claimedRegime) {
    }

    /**
     * @param rumorClaimed what their tip really said, safe to reveal now the round is over
     * @param tipClaim     what they told the room it said, or null if they never said
     */
    public record RoundResult(String playerId, String nickname, double roundScore, double totalScore,
            int liquidations, String rumorClaimed, boolean rumorWasTrue, String tipClaim) {
    }

    public record Settled(int roundIndex, String regime, List<RoundResult> results) {
    }

    public record Standing(int rank, String playerId, String nickname, double totalScore, double bestRound) {
    }

    public record LobbyPlayer(String playerId, String nickname, boolean host) {
    }

    public record Lobby(String code, String phase, int totalRounds, int roundSeconds,
            int intermissionSeconds, double startingCash, int maxPlayers,
            List<LobbyPlayer> players) {
    }

    public record JoinResult(String code, String playerId, String nickname, String token, boolean host) {
    }
}
