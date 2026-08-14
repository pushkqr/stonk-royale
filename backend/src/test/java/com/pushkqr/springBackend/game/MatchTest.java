package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.model.MatchConfig;
import com.pushkqr.springBackend.game.model.Side;
import com.pushkqr.springBackend.game.sim.Regime;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class MatchTest {

    /** Short rounds so a whole match can be stepped through in a test. */
    private static final MatchConfig CONFIG = new MatchConfig(3, 10, 1, 10_000, 12);
    private static final long STEP = 100;

    private Match lobbyOfTwo(String code) {
        Match match = new Match(code, CONFIG);
        match.join("p1", "alice");
        match.join("p2", "bob");
        return match;
    }

    private List<GameEvent> step(Match match, long from, long to) {
        List<GameEvent> events = new ArrayList<>();
        for (long t = from; t <= to; t += STEP) {
            events.addAll(match.tick(t));
        }
        return events;
    }

    /**
     * Starts a match and clears the briefing, which is where every test about rounds
     * actually wants to begin. The tick at {@code now} opens the intermission on the same
     * millisecond the old start(now) did, so timing assertions are unaffected.
     */
    private List<GameEvent> startPlaying(Match match, long now) {
        List<GameEvent> events = new ArrayList<>(match.start(now));
        match.players().forEach(player -> match.markReady(player.id()));
        events.addAll(match.tick(now));
        return events;
    }

    private static <T extends GameEvent> List<T> only(List<GameEvent> events, Class<T> type) {
        return events.stream().filter(type::isInstance).map(type::cast).toList();
    }

    /** Finds a match code whose first round runs the given regime, keeping tests deterministic. */
    private static String codeWithRegime(Regime target) {
        for (int i = 0; i < 10_000; i++) {
            String code = "SEED" + i;
            Match match = new Match(code, CONFIG);
            match.join("p1", "alice");
            match.join("p2", "bob");
            match.start(0);
            if (match.round().regime() == target) {
                return code;
            }
        }
        throw new IllegalStateException("No code produced " + target);
    }

    // --- lobby ---------------------------------------------------------------

    @Test
    void firstPlayerToJoinIsTheHost() {
        Match match = lobbyOfTwo("ABCDE");

        assertTrue(match.player("p1").isHost());
        assertFalse(match.player("p2").isHost());
    }

    @Test
    void rejoiningReturnsTheSameSeat() {
        Match match = lobbyOfTwo("ABCDE");
        assertSame(match.player("p1"), match.join("p1", "alice"));
        assertEquals(2, match.players().size());
    }

    @Test
    void anEmptyRoomCannotStart() {
        // A lone player is allowed, because practice mode needs it and a player alone in
        // their own room harms nobody. Holding Start until a second player arrives is a
        // lobby-UI concern, not an engine invariant.
        assertThrows(IllegalStateException.class, () -> new Match("ABCDE", CONFIG).start(0));
    }

    @Test
    void rejectsJoiningAfterStart() {
        Match match = lobbyOfTwo("ABCDE");
        match.start(0);

        assertThrows(IllegalStateException.class, () -> match.join("p3", "carol"));
    }

    @Test
    void rejectsJoiningAFullMatch() {
        MatchConfig twoSeats = new MatchConfig(3, 10, 1, 10_000, 2);
        Match match = new Match("ABCDE", twoSeats);
        match.join("p1", "alice");
        match.join("p2", "bob");

        assertThrows(IllegalStateException.class, () -> match.join("p3", "carol"));
    }

    // --- phases --------------------------------------------------------------

    @Test
    void startOpensTheBriefingWithTheFirstRoundAlreadyPlanned() {
        Match match = lobbyOfTwo("ABCDE");
        List<GameEvent> events = match.start(0);

        assertEquals(MatchPhase.BRIEFING, match.phase());
        assertEquals(0, match.roundIndex());
        assertEquals(Match.BRIEFING_FAILSAFE_MILLIS, match.phaseEndsAtMillis());

        // Planned up front, so the intermission has something to reveal the instant the
        // gate opens.
        assertNotNull(match.round().asset());
        assertNotNull(match.rumorFor("p1"));
        assertNotNull(match.rumorFor("p2"));

        assertEquals(MatchPhase.BRIEFING, only(events, GameEvent.PhaseChanged.class).get(0).phase());
    }

    @Test
    void theBriefingHoldsUntilEveryoneHasReadied() {
        Match match = lobbyOfTwo("ABCDE");
        match.start(0);

        assertTrue(match.markReady("p1"));
        step(match, 0, 5_000);
        assertEquals(MatchPhase.BRIEFING, match.phase(), "one of two is not everyone");

        assertTrue(match.markReady("p2"));
        step(match, 5_100, 5_100);
        assertEquals(MatchPhase.INTERMISSION, match.phase());
        assertEquals(5_100 + 1_000, match.phaseEndsAtMillis());
    }

    @Test
    void theBriefingGivesUpWaitingAfterTheFailsafe() {
        Match match = lobbyOfTwo("ABCDE");
        match.start(0);
        match.markReady("p1");

        step(match, 0, Match.BRIEFING_FAILSAFE_MILLIS);

        assertEquals(MatchPhase.INTERMISSION, match.phase(), "a locked phone cannot hold the room");
    }

    @Test
    void readyingTwiceChangesNothing() {
        Match match = lobbyOfTwo("ABCDE");
        match.start(0);

        assertTrue(match.markReady("p1"));
        assertFalse(match.markReady("p1"), "the room does not need telling twice");
        assertEquals(1, match.readyCount());
    }

    @Test
    void aStrangerCannotOpenTheGate() {
        Match match = lobbyOfTwo("ABCDE");
        match.start(0);
        match.markReady("p1");

        assertFalse(match.markReady("nobody"));
        step(match, 0, 5_000);

        assertEquals(MatchPhase.BRIEFING, match.phase());
    }

    @Test
    void aRematchClosesTheGateAgain() {
        Match match = finishedMatch("ABCDE");
        match.rematch(false, 40_000);
        match.start(41_000);

        assertEquals(0, match.readyCount(), "last match's readiness must not open this one");
        step(match, 41_000, 46_000);
        assertEquals(MatchPhase.BRIEFING, match.phase());
    }

    @Test
    void leavingTheLobbyFreesTheSeat() {
        Match match = lobbyOfTwo("ABCDE");

        assertTrue(match.leave("p2"));
        assertEquals(1, match.players().size());
        assertNull(match.player("p2"));
    }

    @Test
    void aRematchDoesNotReseatSomebodyWhoLeft() {
        Match match = lobbyOfTwo("ABCDE");
        startPlaying(match, 0);
        step(match, 0, 60_000);
        assertEquals(MatchPhase.FINISHED, match.phase());

        assertTrue(match.leave("p2"));
        match.rematch(false, 60_000);

        assertEquals(1, match.players().size());
        assertNull(match.player("p2"), "a rematch keeps seats, but not one that was given up");
    }

    @Test
    void leavingMidRoundKeepsTheSeat() {
        Match match = lobbyOfTwo("ABCDE");
        startPlaying(match, 0);
        step(match, 0, 1_000);
        assertEquals(MatchPhase.TRADING, match.phase());

        assertFalse(match.leave("p2"));
        assertNotNull(match.player("p2"),
                "standings pointing at a player who vanished mid-match are worse than an idle seat");
    }

    @Test
    void theHostBadgeMovesWhenTheHostLeaves() {
        Match match = lobbyOfTwo("ABCDE");
        assertTrue(match.player("p1").isHost());

        assertTrue(match.leave("p1"));

        assertTrue(match.player("p2").isHost(), "a room nobody can start is a dead room");
    }

    @Test
    void announcedTipCountMatchesTheTipsActuallyDealt() {
        // The count is public while the tips stay private, so the whole mechanic rests on
        // the number agreeing with the cards. Many seeds, because one proves nothing.
        for (int i = 0; i < 200; i++) {
            Match match = lobbyOfTwo("TIPS" + i);
            startPlaying(match, 0);

            int truthful = 0;
            for (String id : List.of("p1", "p2")) {
                if (match.rumorFor(id).truthful()) {
                    truthful++;
                }
            }

            assertEquals(truthful, match.round().truthfulTipCount());
        }
    }

    @Test
    void everyRoundHoldsAtLeastOneTrueTip() {
        // A round with no true tip gives the table nothing to check a claim against, so the
        // planner forces one. This is the assertion that keeps that promise honest.
        for (int i = 0; i < 500; i++) {
            Match match = lobbyOfTwo("TRUE" + i);
            startPlaying(match, 0);
            assertTrue(match.round().truthfulTipCount() >= 1,
                    "round planned from seed TRUE" + i + " dealt no true tip");
        }
    }

    @Test
    void tipCountStillVariesAboveTheGuaranteedOne() {
        Set<Integer> seen = new HashSet<>();
        for (int i = 0; i < 500 && seen.size() < 2; i++) {
            Match match = lobbyOfTwo("VARY" + i);
            startPlaying(match, 0);
            seen.add(match.round().truthfulTipCount());
        }

        // Forcing a floor must not flatten the count into a constant — if every round said
        // "one of you", the number would stop being information.
        assertEquals(Set.of(1, 2), seen);
    }

    @Test
    void intermissionGivesWayToTrading() {
        Match match = lobbyOfTwo("ABCDE");
        startPlaying(match, 0);

        List<GameEvent> events = step(match, 0, 1_000);

        assertEquals(MatchPhase.TRADING, match.phase());
        assertEquals(11_000, match.phaseEndsAtMillis());
        assertEquals(CONFIG.startingCash(), match.player("p1").round().cash());
        assertTrue(only(events, GameEvent.PhaseChanged.class).stream()
                .anyMatch(e -> e.phase() == MatchPhase.TRADING));
    }

    @Test
    void tradingIsClosedOutsideAnOpenRound() {
        Match match = lobbyOfTwo("ABCDE");
        startPlaying(match, 0);

        assertThrows(IllegalStateException.class,
                () -> match.openPosition("p1", Side.LONG, 1.0, 5, 500));
    }

    // --- the round -----------------------------------------------------------

    @Test
    void aTipClaimIsCarriedIntoTheSettleAndCanBeCaughtOut() {
        Match match = lobbyOfTwo("ABCDE");
        startPlaying(match, 0);
        step(match, 0, 1_000);

        // alice tells the room something; bob keeps quiet.
        match.recordTipClaim("p1", Regime.SQUEEZE);

        List<GameEvent> events = step(match, 1_100, 11_000);
        RoundResult alice = resultFor(events, "p1");
        RoundResult bob = resultFor(events, "p2");

        assertEquals(Regime.SQUEEZE, alice.claimedTipAs());
        assertNull(bob.claimedTipAs(), "a player who said nothing must not be put on record");

        // Whether that was a lie is exactly the two fields disagreeing, which is the only
        // dishonesty the server can actually prove.
        assertEquals(alice.rumorClaimed() != Regime.SQUEEZE,
                alice.claimedTipAs() != alice.rumorClaimed());
    }

    @Test
    void tipClaimsDoNotSurviveIntoTheNextRound() {
        Match match = lobbyOfTwo("ABCDE");
        startPlaying(match, 0);
        step(match, 0, 1_000);
        match.recordTipClaim("p1", Regime.RUG);

        // Through the settle, the next intermission, and into round two.
        List<GameEvent> events = step(match, 1_100, 23_000);

        assertEquals(Regime.RUG, resultFor(events, "p1").claimedTipAs());
        assertNull(lastResultFor(events, "p1").claimedTipAs(),
                "round two must start with nobody on record");
    }

    @Test
    void aClaimMadeDuringTheIntermissionSurvivesIntoTheRound() {
        Match match = lobbyOfTwo("ABCDE");
        startPlaying(match, 0);

        // The market is shut, but the tip has been dealt and this is where the talking
        // happens — so going on record here has to count.
        match.recordTipClaim("p1", Regime.PUMP);

        List<GameEvent> events = step(match, 0, 11_000);
        assertEquals(Regime.PUMP, resultFor(events, "p1").claimedTipAs());
    }

    @Test
    void claimsMadeBeforeTheMatchStartsAreIgnored() {
        Match match = lobbyOfTwo("ABCDE");

        // Still the lobby: no tip exists yet, so there is nothing to be claiming about.
        match.recordTipClaim("p1", Regime.PUMP);
        startPlaying(match, 0);

        List<GameEvent> events = step(match, 0, 11_000);
        assertNull(resultFor(events, "p1").claimedTipAs());
    }

    private static RoundResult resultFor(List<GameEvent> events, String playerId) {
        return only(events, GameEvent.RoundSettled.class).get(0).results().stream()
                .filter(r -> r.playerId().equals(playerId)).findFirst().orElseThrow();
    }

    private static RoundResult lastResultFor(List<GameEvent> events, String playerId) {
        List<GameEvent.RoundSettled> settled = only(events, GameEvent.RoundSettled.class);
        return settled.get(settled.size() - 1).results().stream()
                .filter(r -> r.playerId().equals(playerId)).findFirst().orElseThrow();
    }

    @Test
    void bothHeadlinesBreakDuringTheRound() {
        Match match = lobbyOfTwo("ABCDE");
        startPlaying(match, 0);

        List<GameEvent> events = step(match, 0, 11_000);

        assertEquals(2, only(events, GameEvent.NewsBroken.class).size());
    }

    @Test
    void aRuggedLongAtMaxLeverageIsLiquidated() {
        Match match = lobbyOfTwo(codeWithRegime(Regime.RUG));
        startPlaying(match, 0);
        step(match, 0, 1_000);

        match.openPosition("p1", Side.LONG, 1.0, 10, 1_000);
        List<GameEvent> events = step(match, 1_100, 11_000);

        List<GameEvent.PlayerLiquidated> liquidations = only(events, GameEvent.PlayerLiquidated.class);
        assertEquals(1, liquidations.size());
        assertEquals("alice", liquidations.get(0).nickname());
        // 90% of the $10,000 margin.
        assertEquals(9_000, liquidations.get(0).marginLost(), 1e-6);
    }

    /**
     * For tests where the exact headcount matters and the existing lobbyOfTwo is not
     * enough. Left separate from lobbyOfTwo rather than generalising it, since other tests
     * depend on that method's exact name and two-player shape.
     */
    private Match lobbyOf(String code, int n) {
        Match match = new Match(code, CONFIG);
        for (int i = 1; i <= n; i++) {
            match.join("p" + i, "player" + i);
        }
        return match;
    }

    @Test
    void oneMaxTradeMovesPriceOneToTwoPercent() {
        Match match = lobbyOfTwo("SOLOMAX");
        startPlaying(match, 0);
        step(match, 0, 1_000);

        match.openPosition("p1", Side.LONG, 1.0, 10, 1_000);

        double base = match.round().priceAt(0);
        double effective = match.currentPrice(1_000);
        double pctMove = (effective - base) / base;
        assertTrue(pctMove >= 0.01 && pctMove <= 0.02,
                "one player's largest trade moved price by " + (pctMove * 100) + "%");
    }

    @Test
    void sixPlayersPilingInMovesPriceFourToSixPercent() {
        Match match = lobbyOf("SIXUP", 6);
        startPlaying(match, 0);
        step(match, 0, 1_000);

        for (int i = 1; i <= 6; i++) {
            match.openPosition("p" + i, Side.LONG, 1.0, 10, 1_000);
        }

        double base = match.round().priceAt(0);
        double effective = match.currentPrice(1_000);
        double pctMove = (effective - base) / base;
        // Six kicks of 0.015 sum to 0.09, clamped by MarketImpact.MAX_IMPACT to exactly
        // 0.06 — the same literal as this upper bound. A tiny epsilon absorbs the ~1-ULP
        // rounding from round-tripping that clamp through base * (1 + value) and back to
        // a fraction; production impact is still genuinely capped at 6%.
        assertTrue(pctMove >= 0.04 && pctMove <= 0.06 + 1e-9,
                "six players piling in together moved price by " + (pctMove * 100) + "%");
    }

    @Test
    void aForcedLiquidationPushesPriceFurtherInTheDirectionOfTheForcedSell() {
        Match match = lobbyOfTwo(codeWithRegime(Regime.RUG));
        startPlaying(match, 0);
        step(match, 0, 1_000);
        match.openPosition("p1", Side.LONG, 1.0, 10, 1_000);

        long now = 1_100;
        double impactBefore;
        double impactAfter;
        List<GameEvent> events;
        while (true) {
            long elapsed = now - 1_000;
            impactBefore = match.currentPrice(now) - match.round().priceAt(elapsed);
            events = match.tick(now);
            impactAfter = match.currentPrice(now) - match.round().priceAt(elapsed);
            if (!only(events, GameEvent.PlayerLiquidated.class).isEmpty()) {
                break;
            }
            now += 100;
            assertTrue(now < 11_000, "expected a liquidation before the round ended");
        }

        // The liquidation force-sells a long: extra downward pressure on top of whatever
        // the RUG shock itself was already doing at that instant.
        assertTrue(impactAfter < impactBefore,
                "a forced close must push price further in its own direction, like any trade");
    }

    @Test
    void roundSettlesWithScoresAndTheRumorReveal() {
        Match match = lobbyOfTwo("ABCDE");
        startPlaying(match, 0);
        step(match, 0, 1_000);

        List<GameEvent> events = step(match, 1_100, 11_000);
        GameEvent.RoundSettled settled = only(events, GameEvent.RoundSettled.class).get(0);

        assertEquals(0, settled.roundIndex());
        assertEquals(2, settled.results().size());
        assertNotNull(settled.regime());

        // Nobody traded, so both are flat.
        settled.results().forEach(result -> {
            assertEquals(0, result.roundScore(), 1e-9);
            assertNotNull(result.rumorClaimed());
        });
    }

    @Test
    void openPositionsAreForceClosedAtTheBuzzer() {
        Match match = lobbyOfTwo("ABCDE");
        startPlaying(match, 0);
        step(match, 0, 1_000);
        match.openPosition("p1", Side.LONG, 0.5, 2, 1_000);

        List<GameEvent> events = step(match, 1_100, 11_000);
        GameEvent.RoundSettled settled = only(events, GameEvent.RoundSettled.class).get(0);

        RoundResult alice = settled.results().stream()
                .filter(r -> r.playerId().equals("p1")).findFirst().orElseThrow();
        assertNotEquals(0.0, alice.roundScore(), "a held position must settle to a real score");
    }

    /**
     * The rule the whole design rests on: a blowup in one round must not carry into the
     * next, so nobody spends the match watching.
     */
    @Test
    void cashResetsEveryRound() {
        Match match = lobbyOfTwo(codeWithRegime(Regime.RUG));
        startPlaying(match, 0);
        step(match, 0, 1_000);

        match.openPosition("p1", Side.LONG, 1.0, 10, 1_000);
        step(match, 1_100, 11_000);

        // Wiped out in round 0...
        assertTrue(match.player("p1").roundScores().get(0) < -50);

        // ...and back to a full stack for round 1.
        step(match, 11_100, 12_000);
        assertEquals(MatchPhase.TRADING, match.phase());
        assertEquals(CONFIG.startingCash(), match.player("p1").round().cash());
        assertFalse(match.player("p1").round().hasPosition());
    }

    // --- whole match ---------------------------------------------------------

    @Test
    void matchRunsEveryRoundThenFinishes() {
        Match match = lobbyOfTwo("ABCDE");
        startPlaying(match, 0);

        List<GameEvent> events = step(match, 0, 33_000);

        assertEquals(MatchPhase.FINISHED, match.phase());
        assertEquals(3, only(events, GameEvent.RoundSettled.class).size());
        assertEquals(3, match.player("p1").roundScores().size());
        assertTrue(only(events, GameEvent.PhaseChanged.class).stream()
                .anyMatch(e -> e.phase() == MatchPhase.FINISHED));
    }

    @Test
    void finishedMatchStopsProducingEvents() {
        Match match = lobbyOfTwo("ABCDE");
        startPlaying(match, 0);
        step(match, 0, 33_000);

        assertTrue(step(match, 33_100, 40_000).isEmpty());
    }

    @Test
    void everyRoundUsesADifferentAsset() {
        Match match = lobbyOfTwo("ABCDE");
        startPlaying(match, 0);

        List<String> tickers = new ArrayList<>();
        for (long t = 0; t <= 33_000; t += STEP) {
            match.tick(t);
            if (match.round() != null && !tickers.contains(match.round().asset().ticker())) {
                tickers.add(match.round().asset().ticker());
            }
        }

        assertEquals(3, tickers.size(), "a match should not repeat an asset: " + tickers);
    }

    @Test
    void standingsRankByTotalScore() {
        Match match = lobbyOfTwo(codeWithRegime(Regime.PUMP));
        startPlaying(match, 0);
        step(match, 0, 1_000);

        match.openPosition("p1", Side.LONG, 1.0, 2, 1_000);   // rides the pump
        step(match, 1_100, 33_000);

        List<Standing> standings = match.standings();
        assertEquals(2, standings.size());
        assertEquals(1, standings.get(0).rank());
        assertEquals("alice", standings.get(0).nickname());
        assertTrue(standings.get(0).totalScore() > standings.get(1).totalScore());
    }

    // --- rematch -------------------------------------------------------------

    private Match finishedMatch(String code) {
        Match match = lobbyOfTwo(code);
        startPlaying(match, 0);
        step(match, 0, 33_000);
        return match;
    }

    @Test
    void rematchReopensTheRoomKeepingEveryone() {
        Match match = finishedMatch("ABCDE");
        assertEquals(MatchPhase.FINISHED, match.phase());

        match.rematch(false, 40_000);

        assertEquals(MatchPhase.LOBBY, match.phase());
        assertEquals(2, match.players().size(), "nobody should have to rejoin");
        assertTrue(match.player("p1").isHost(), "the host stays the host");
        assertTrue(match.player("p1").roundScores().isEmpty(), "scores start clean");
        assertEquals(0, match.player("p1").totalScore());
    }

    @Test
    void rematchGoesBackToLobbySoLatecomersCanJoin() {
        Match match = finishedMatch("ABCDE");
        match.rematch(false, 40_000);

        assertDoesNotThrow(() -> match.join("p3", "carol"));
        assertEquals(3, match.players().size());
    }

    @Test
    void rematchCanReplayTheSameMarket() {
        Match match = finishedMatch("ABCDE");
        var firstRegime = new ArrayList<Regime>();
        // Re-derive round 0 of the original by replaying a fresh match on the same code.
        Match reference = lobbyOfTwo("ABCDE");
        startPlaying(reference, 0);
        firstRegime.add(reference.round().regime());

        match.rematch(true, 40_000);
        startPlaying(match, 41_000);

        assertEquals(firstRegime.get(0), match.round().regime());
        assertEquals(reference.round().asset(), match.round().asset());
        assertArrayEquals(reference.round().path().toArray(), match.round().path().toArray());
    }

    @Test
    void rematchOnANewMarketChangesThePath() {
        Match match = finishedMatch("ABCDE");
        Match reference = lobbyOfTwo("ABCDE");
        startPlaying(reference, 0);

        match.rematch(false, 40_000);
        startPlaying(match, 41_000);

        assertFalse(
                java.util.Arrays.equals(reference.round().path().toArray(), match.round().path().toArray()),
                "a fresh market must not replay the previous one");
    }

    @Test
    void rematchIsRejectedWhileTheMatchIsStillRunning() {
        Match match = lobbyOfTwo("ABCDE");
        startPlaying(match, 0);

        assertThrows(IllegalStateException.class, () -> match.rematch(false, 1_000));
    }

    // --- solo ----------------------------------------------------------------

    @Test
    void aSinglePlayerCanStartAPracticeMatch() {
        Match match = new Match("SOLO1", new MatchConfig(1, 10, 1, 10_000, 12));
        match.join("p1", "alice");

        assertDoesNotThrow(() -> match.start(0));
        match.markReady("p1");
        step(match, 0, 12_000);
        assertEquals(MatchPhase.FINISHED, match.phase());
        assertEquals(1, match.player("p1").roundScores().size());
    }

    @Test
    void sameCodeReplaysTheSameMarket() {
        Match first = lobbyOfTwo("REPLAY");
        Match second = lobbyOfTwo("REPLAY");
        startPlaying(first, 0);
        startPlaying(second, 0);

        assertEquals(first.round().regime(), second.round().regime());
        assertEquals(first.round().asset(), second.round().asset());
        assertArrayEquals(first.round().path().toArray(), second.round().path().toArray());
    }
}
