package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.model.MatchConfig;
import com.pushkqr.springBackend.game.model.Side;
import com.pushkqr.springBackend.game.sim.Regime;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.junit.jupiter.api.Assertions.*;

class MatchTest {

    /** Short rounds so a whole match can be stepped through in a test. */
    private static final MatchConfig CONFIG = new MatchConfig(3, 10, 1, 10_000, 12);
    private static final long STEP = 100;

    private Match lobbyOfTwo(String code) {
        Match match = new Match(code, CONFIG);
        match.join("p1", "alice");
        match.join("p2", "bob");
        match.markConnected("p1", true, 0);
        match.markConnected("p2", true, 0);
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
        match.players().forEach(player -> {
            match.markConnected(player.id(), true, now);
            match.markReady(player.id());
        });
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
            match.markConnected("p1", true, 0);
            match.markConnected("p2", true, 0);
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
    void allowsJoiningAfterStart() {
        Match match = lobbyOfTwo("ABCDE");
        match.start(0);

        MatchPlayer joined = match.join("p3", "carol");
        assertNotNull(joined);
        assertEquals("carol", joined.nickname());
    }

    @Test
    void rejectsJoiningAFullMatch() {
        MatchConfig twoSeats = new MatchConfig(3, 10, 1, 10_000, 2);
        Match match = new Match("ABCDE", twoSeats);
        match.join("p1", "alice");
        match.join("p2", "bob");

        assertThrows(IllegalStateException.class, () -> match.join("p3", "carol"));
    }

    @Test
    void aRoomIsPrivateUnlessItIsAskedNotToBe() {
        Match match = new Match("VIS1", MatchConfig.standard());

        // Code-only is the default, and the only way a room becomes discoverable is somebody
        // deciding it should be.
        assertThat(match.isPublic()).isFalse();
    }

    @Test
    void aRoomCanBeOpenedUpAndClosedAgain() {
        Match match = new Match("VIS2", MatchConfig.standard());

        match.setVisibility(true);
        assertThat(match.isPublic()).isTrue();

        match.setVisibility(false);
        assertThat(match.isPublic()).isFalse();
    }

    @Test
    void theHostCanRetuneTheMatchFromTheLobby() {
        Match match = lobbyOfTwo("CONFIG1");
        match.updateConfig(new MatchConfig(7, 120, 30, 50_000, 8));

        assertEquals(7, match.config().rounds());
        assertEquals(120, match.config().roundSeconds());
        assertEquals(8, match.config().maxPlayers());
    }

    @Test
    void settingsAreFrozenOnceTheMatchIsRunning() {
        Match match = lobbyOfTwo("CONFIG2");
        startPlaying(match, 0);

        assertThrows(IllegalStateException.class,
                () -> match.updateConfig(new MatchConfig(7, 120, 30, 50_000, 8)));
    }

    @Test
    void theRoomCannotBeShrunkBelowThePeopleAlreadyInIt() {
        Match match = new Match("CONFIG3", CONFIG);
        match.join("p1", "alice");
        match.join("p2", "bob");
        match.join("p3", "carol");

        assertThrows(IllegalArgumentException.class,
                () -> match.updateConfig(new MatchConfig(5, 90, 25, 10_000, 2)),
                "three players cannot fit in a two-seat room");
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
    void aDisconnectedPlayerDoesNotHoldTheBriefingGateOpen() {
        Match match = lobbyOfTwo("GHOST1");
        match.start(0);
        match.markReady("p1");

        // p2 closed their window without readying. Before disconnect handling existed this
        // hung the whole room until the 90s failsafe.
        match.tick(100);
        assertEquals(MatchPhase.BRIEFING, match.phase(), "still waiting on p2");

        match.markConnected("p2", false, 150);
        match.tick(200);
        assertEquals(MatchPhase.INTERMISSION, match.phase(),
                "a disconnected player must not block the gate");
    }

    @Test
    void aReconnectingPlayerCountsAgainstTheGate() {
        Match match = lobbyOfTwo("GHOST2");
        match.start(0);
        match.markReady("p1");
        match.markConnected("p2", false, 50);
        match.markConnected("p2", true, 80);

        match.tick(100);
        assertEquals(MatchPhase.BRIEFING, match.phase(),
                "p2 is back and has not readied, so the gate must stay shut");
    }

    @Test
    void theGateDoesNotOpenWhenEverybodyHasVanished() {
        Match match = lobbyOfTwo("GHOST3");
        match.start(0);
        match.markConnected("p1", false, 50);
        match.markConnected("p2", false, 50);

        match.tick(100);
        assertEquals(MatchPhase.BRIEFING, match.phase(),
                "an empty room must not fall through the gate on a vacuous truth");
    }

    @Test
    void botsDoNotHoldTheBriefingGateShut() {
        Match match = new Match("TEST1", new MatchConfig(1, 60, 8, 10_000, 12));
        match.join("human", "You");
        match.markConnected("human", true, 0);
        match.addBot("bot:1", "Vega");
        match.addBot("bot:2", "Kite");

        match.start(0);
        match.markReady("human");

        // The human is the only one who can read a briefing, so their click alone opens it.
        List<GameEvent> events = match.tick(100);

        assertThat(events).anyMatch(e -> e instanceof GameEvent.PhaseChanged phase
                && phase.phase() == MatchPhase.INTERMISSION);
    }

    @Test
    void aRoomOfNothingButBotsCountsAsAbandoned() {
        Match match = new Match("TEST2", new MatchConfig(1, 60, 8, 10_000, 12));
        match.join("human", "You");
        match.addBot("bot:1", "Vega");

        assertThat(match.hasNoHumans()).isFalse();

        match.leave("human");

        // Bots must never keep a room alive — nothing would ever reap it.
        assertThat(match.hasNoHumans()).isTrue();
        assertThat(match.players()).hasSize(1);
    }

    @Test
    void botsAreFlaggedAndHumansAreNot() {
        Match match = new Match("TEST3", new MatchConfig(1, 60, 8, 10_000, 12));
        assertThat(match.join("human", "You").isBot()).isFalse();
        assertThat(match.addBot("bot:1", "Vega").isBot()).isTrue();
    }

    private Match practiceLikeMatch(String code) {
        Match match = new Match(code, new MatchConfig(1, 60, 20, 10_000, 12));
        match.join("human", "You");
        match.markConnected("human", true, 0);
        match.addBot("bot:1", "Vega");
        match.addBot("bot:2", "Kite");
        match.addBot("bot:3", "Moss");
        return match;
    }

    /** Drives a match from its start to the given elapsed time inside the trading round. */
    private List<GameEvent> runTo(Match match, long start, long untilElapsed) {
        List<GameEvent> all = new ArrayList<>();
        match.start(start);
        match.markReady("human");
        for (long t = start; t <= start + 20_000 + untilElapsed; t += 100) {
            all.addAll(match.tick(t));
        }
        return all;
    }

    @Test
    void botsTradeDuringTheRound() {
        Match match = practiceLikeMatch("BOTS1");
        List<GameEvent> events = runTo(match, 0, 60_000);

        assertThat(events).anyMatch(GameEvent.BotOpened.class::isInstance);
    }

    @Test
    void botsGoOnRecordDuringTheIntermission() {
        Match match = practiceLikeMatch("BOTS2");
        List<GameEvent> events = runTo(match, 0, 1_000);

        assertThat(events)
                .filteredOn(GameEvent.BotSaid.class::isInstance)
                .hasSizeGreaterThanOrEqualTo(3);
    }

    @Test
    void aBotsTradeMovesThePrice() {
        Match match = practiceLikeMatch("BOTS3");
        match.start(0);
        match.markReady("human");

        // The human's click opens the briefing at once, so the 20s intermission runs 0..20_000
        // and trading begins exactly on the last tick of that loop.
        for (long t = 0; t <= 20_000; t += 100) {
            match.tick(t);
        }
        assertThat(match.phase()).isEqualTo(MatchPhase.TRADING);

        // Derived, not assumed: the round's start is the only thing the impact is measured from.
        long roundStart = match.phaseEndsAtMillis() - 60_000;
        long elapsed = 12_000;
        for (long t = roundStart; t <= roundStart + elapsed; t += 100) {
            match.tick(t);
        }

        // By 12s all three bots have entered and none of their kicks has decayed away, so the
        // live price is the path times a push of order 1e-3 — far above float noise.
        double base = match.round().priceAt(elapsed);
        double live = match.currentPrice(roundStart + elapsed);

        assertThat(Math.abs(live / base - 1)).isGreaterThan(1e-6);
    }

    @Test
    void botsPlaceInTheStandings() {
        Match match = practiceLikeMatch("BOTS4");
        runTo(match, 0, 61_000);

        assertThat(match.standings()).hasSize(4);
        assertThat(match.standings())
                .extracting(Standing::nickname)
                .contains("Vega", "Kite", "Moss");
    }

    @Test
    void aWipedBotSkipsTheRestOfItsScriptInsteadOfThrowing() {
        // Every scheduled action is precondition-checked, so a bot that has been liquidated out
        // of its cash simply stops trading. An exception here would escape tick() and abandon
        // the rest of the round — liquidation checks and settlement included.
        Match match = practiceLikeMatch("BOTS5");
        assertThatCode(() -> runTo(match, 0, 61_000)).doesNotThrowAnyException();
    }

    @Test
    void leavingIsAllowedFromTheLobbyButNotMidRound() {
        Match lobby = lobbyOfTwo("LEAVE1");
        assertTrue(lobby.leave("p2"), "a lobby seat can be given up");

        Match playing = lobbyOfTwo("LEAVE2");
        startPlaying(playing, 0);
        step(playing, 0, 1_000);
        assertFalse(playing.leave("p2"), "a mid-round seat is kept on purpose");
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
    void aRejectedOpenLeavesThePriceUntouched() {
        Match match = lobbyOfTwo("REJECT1");
        startPlaying(match, 0);
        step(match, 0, 1_000);

        match.openPosition("p1", Side.LONG, 1.0, 10, 1_000);
        double afterFirstOpen = match.currentPrice(1_000);

        // A second open must be rejected — and must not push the price further while
        // being rejected.
        assertThrows(IllegalStateException.class,
                () -> match.openPosition("p1", Side.LONG, 1.0, 10, 1_000));
        assertEquals(afterFirstOpen, match.currentPrice(1_000), 1e-9,
                "a rejected open must not move the price at all");
    }

    @Test
    void sixPlayersPilingInReachesTheFourPercentClamp() {
        Match match = lobbyOf("SIXUP", 6);
        startPlaying(match, 0);
        step(match, 0, 1_000);

        for (int i = 1; i <= 6; i++) {
            match.openPosition("p" + i, Side.LONG, 1.0, 10, 1_000);
        }

        double base = match.round().priceAt(0);
        double effective = match.currentPrice(1_000);
        double pctMove = (effective - base) / base;
        // Six kicks of 1.5% sum to 9% raw, clamped to MarketImpact's 4% cap. The lower
        // bound is loose (three players alone already clamp it) — the point of this test
        // is that a crowd reliably reaches the cap, not the exact headcount needed to.
        assertTrue(pctMove >= 0.03 && pctMove <= 0.04 + 1e-9,
                "six players piling in together moved price by " + (pctMove * 100) + "%");
    }

    @Test
    void heavyOneSidedFlowFiresASurgeEventOnce() {
        Match match = lobbyOf("FLOWX", 3);
        startPlaying(match, 0);
        step(match, 0, 1_000);

        // Three full-stack max-leverage longs at once is well past the surge threshold —
        // one alone (1.5%) is not, which is deliberate: a surge should mean the room, not
        // one player.
        match.openPosition("p1", Side.LONG, 1.0, 10, 1_000);
        match.openPosition("p2", Side.LONG, 1.0, 10, 1_000);
        match.openPosition("p3", Side.LONG, 1.0, 10, 1_000);
        List<GameEvent> events = match.tick(1_000);

        List<GameEvent.FlowSurge> surges = only(events, GameEvent.FlowSurge.class);
        assertEquals(1, surges.size());
        assertTrue(surges.get(0).roomIsBuying());
    }

    @Test
    void stayingAboveTheThresholdDoesNotRefireEveryTick() {
        Match match = lobbyOf("FLOWZ", 3);
        startPlaying(match, 0);
        step(match, 0, 1_000);

        match.openPosition("p1", Side.LONG, 1.0, 10, 1_000);
        match.openPosition("p2", Side.LONG, 1.0, 10, 1_000);
        match.openPosition("p3", Side.LONG, 1.0, 10, 1_000);
        assertEquals(1, only(match.tick(1_000), GameEvent.FlowSurge.class).size());

        // Immediately re-ticking at the same instant, with impact still above threshold,
        // must not double-count the same surge.
        assertEquals(0, only(match.tick(1_000), GameEvent.FlowSurge.class).size());
    }

    @Test
    void flowSurgeCanFireAgainNextRoundEvenRightAfterOneFiredInTheLast() {
        Match match = lobbyOf("FLOWY", 3);
        startPlaying(match, 0);
        step(match, 0, 1_000);

        match.openPosition("p1", Side.LONG, 1.0, 10, 1_000);
        match.openPosition("p2", Side.LONG, 1.0, 10, 1_000);
        match.openPosition("p3", Side.LONG, 1.0, 10, 1_000);
        assertEquals(1, only(match.tick(1_000), GameEvent.FlowSurge.class).size());

        // Ride the rest of round 0 out and into round 1's trading phase.
        step(match, 1_100, 12_000);
        assertEquals(MatchPhase.TRADING, match.phase());
        assertEquals(1, match.roundIndex());

        // Derived from the match itself rather than hand-computed, so this does not
        // silently drift if intermission or round-length defaults ever change: during
        // TRADING, phaseEndsAtMillis is always roundStartedAtMillis + roundMillis.
        long round1Start = match.phaseEndsAtMillis() - CONFIG.roundMillis();

        match.openPosition("p1", Side.LONG, 1.0, 10, round1Start);
        match.openPosition("p2", Side.LONG, 1.0, 10, round1Start);
        match.openPosition("p3", Side.LONG, 1.0, 10, round1Start);
        assertEquals(1, only(match.tick(round1Start), GameEvent.FlowSurge.class).size());
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
        match.markConnected("p1", true, 0);

        assertDoesNotThrow(() -> match.start(0));
        match.markReady("p1");
        step(match, 0, 12_000);
        assertEquals(MatchPhase.FINISHED, match.phase());
        assertEquals(1, match.player("p1").roundScores().size());
    }

    @Test
    void markingHumanReadyAdvancesDirectlyToIntermissionInPracticeWithBots() {
        Match match = new Match("PRACTICE", new MatchConfig(3, 10, 1, 10_000, 12));
        match.join("p1", "alice");
        match.markConnected("p1", true, 0);
        match.addBot("bot:0", "Vega");
        match.addBot("bot:1", "Kite");
        match.addBot("bot:2", "Moss");

        match.start(0);
        assertEquals(MatchPhase.BRIEFING, match.phase());

        boolean advanced = match.markReady("p1");
        assertTrue(advanced);
        match.tick(0);
        assertEquals(MatchPhase.INTERMISSION, match.phase());
        assertEquals(0, match.round().roundIndex());
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
