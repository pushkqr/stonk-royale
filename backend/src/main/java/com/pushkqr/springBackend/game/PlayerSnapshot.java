package com.pushkqr.springBackend.game;

/**
 * One player, frozen. Everything any caller outside this package is allowed to know.
 *
 * Exists because the lock on Match never protected what callers actually read. Match holds
 * its own maps under a monitor, but players() copied only the list — the MatchPlayer objects
 * inside it are mutable, carry no synchronization of their own, and were being read from
 * three threads at once: the engine's scheduler, STOMP handlers, and admin HTTP requests.
 * The convention was that a caller reached for `synchronized (match)` itself, and three call
 * sites forgot, one of which could read a position mid-close.
 *
 * Built inside Match's lock and immutable afterwards, so there is nothing left to forget.
 * The round fields are resolved against a single price taken in that same critical section,
 * which is also what stops a board from mixing one player's equity at one price with
 * another's at the next tick's.
 *
 * @param inRound false for somebody who joined after this round was planned — they hold no
 *                stack until the next one deals, and cash/equity/scoreAt are all zero
 */
public record PlayerSnapshot(
        String id,
        String nickname,
        boolean host,
        boolean bot,
        boolean connected,
        boolean left,
        String avatar,
        double totalScore,
        boolean inRound,
        double cash,
        double equity,
        double scoreAt,
        Open position) {

    /** An open position, priced at the same instant as the rest of the snapshot. */
    public record Open(String side, double margin, int leverage, double entryPrice,
            double liquidationPrice, double unrealisedPnl) {
    }
}
