package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.info.MarketEvent;
import com.pushkqr.springBackend.game.info.Rumor;
import com.pushkqr.springBackend.game.model.MatchConfig;
import com.pushkqr.springBackend.game.model.PlayerRound;
import com.pushkqr.springBackend.game.model.Position;
import com.pushkqr.springBackend.game.model.Side;
import com.pushkqr.springBackend.game.sim.Regime;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * One live match, held entirely in memory.
 *
 * Deliberately free of Spring and persistence: {@link #tick(long)} takes the current time
 * and returns what happened, so the whole game loop can be tested by calling it with made-up
 * timestamps instead of waiting out real 90-second rounds.
 */
public final class Match {

    /**
     * One, not two. A player alone in their own room is harmless, and practice mode needs
     * it. The lobby UI still withholds Start until a second player arrives, which is where
     * "don't start before your friends turn up" actually belongs.
     */
    public static final int MIN_PLAYERS = 1;

    private final String code;
    private final MatchConfig config;
    private final Map<String, MatchPlayer> players = new LinkedHashMap<>();
    private final RoundPlanner planner = new RoundPlanner();

    private MatchPhase phase = MatchPhase.LOBBY;
    private int roundIndex = -1;
    private long phaseEndsAtMillis;
    private long roundStartedAtMillis;
    private RoundPlan round;
    private int newsFired;

    /**
     * What each player has told the room their tip says, this round only.
     *
     * Held here rather than on the player because it is evidence about a round, not money:
     * it exists to be compared against the tip they were actually dealt, which is the only
     * lie the server can prove.
     */
    private final Map<String, Regime> tipClaims = new LinkedHashMap<>();

    /** Bumped by a rematch that wants a fresh market; held to replay the same one. */
    private int generation;

    public Match(String code, MatchConfig config) {
        this.code = code;
        this.config = config;
    }

    // --- lobby ---------------------------------------------------------------

    public MatchPlayer join(String playerId, String nickname) {
        if (phase != MatchPhase.LOBBY) {
            throw new IllegalStateException("Match has already started");
        }
        if (players.containsKey(playerId)) {
            return players.get(playerId);
        }
        if (players.size() >= config.maxPlayers()) {
            throw new IllegalStateException("Match is full");
        }
        MatchPlayer player = new MatchPlayer(playerId, nickname, players.isEmpty());
        players.put(playerId, player);
        return player;
    }

    public void leave(String playerId) {
        if (phase == MatchPhase.LOBBY) {
            players.remove(playerId);
        }
        // Mid-match departures keep their seat so scores and standings stay stable.
    }

    /**
     * Starts the match into its first intermission. The upcoming round is planned here so
     * the intermission can reveal the asset and hand out rumors before trading opens.
     */
    public List<GameEvent> start(long now) {
        if (phase != MatchPhase.LOBBY) {
            throw new IllegalStateException("Match has already started");
        }
        if (players.size() < MIN_PLAYERS) {
            throw new IllegalStateException("Need at least " + MIN_PLAYERS + " players");
        }
        List<GameEvent> events = new ArrayList<>();
        planRound(0);
        enterIntermission(now, events);
        return events;
    }

    /**
     * Reopens the finished room for another match, keeping every seat and setting.
     *
     * Returning to LOBBY rather than straight into a round is deliberate: it is the only
     * window in which someone new can join, so it doubles as the way a latecomer gets in.
     *
     * @param sameMarket replay the identical market, making the rematch a fair rerun
     */
    public List<GameEvent> rematch(boolean sameMarket, long now) {
        if (phase != MatchPhase.FINISHED) {
            throw new IllegalStateException("The match is still running");
        }
        if (!sameMarket) {
            generation++;
        }

        players.values().forEach(MatchPlayer::resetForRematch);
        tipClaims.clear();
        phase = MatchPhase.LOBBY;
        roundIndex = -1;
        round = null;
        newsFired = 0;
        phaseEndsAtMillis = now;

        return List.of(new GameEvent.PhaseChanged(MatchPhase.LOBBY, roundIndex, now));
    }

    // --- the loop ------------------------------------------------------------

    public List<GameEvent> tick(long now) {
        List<GameEvent> events = new ArrayList<>();
        switch (phase) {
            case LOBBY, FINISHED -> {
            }
            case INTERMISSION -> {
                if (now >= phaseEndsAtMillis) {
                    beginTrading(now, events);
                }
            }
            case TRADING -> {
                long elapsed = now - roundStartedAtMillis;
                double price = round.priceAt(elapsed);
                fireDueNews(elapsed, events);
                checkLiquidations(price, events);
                if (now >= phaseEndsAtMillis) {
                    settleRound(price, now, events);
                }
            }
        }
        return events;
    }

    private void fireDueNews(long elapsed, List<GameEvent> events) {
        List<MarketEvent> scheduled = round.events();
        while (newsFired < scheduled.size() && scheduled.get(newsFired).atMillis() <= elapsed) {
            events.add(new GameEvent.NewsBroken(scheduled.get(newsFired).headline()));
            newsFired++;
        }
    }

    private void checkLiquidations(double price, List<GameEvent> events) {
        for (MatchPlayer player : players.values()) {
            PlayerRound playerRound = player.round();
            if (playerRound == null || !playerRound.hasPosition()) {
                continue;
            }
            double margin = playerRound.position().margin();
            if (playerRound.liquidateIfBreached(price)) {
                events.add(new GameEvent.PlayerLiquidated(
                        player.id(), player.nickname(), margin * Position.MAINTENANCE));
            }
        }
    }

    private void settleRound(double finalPrice, long now, List<GameEvent> events) {
        List<RoundResult> results = new ArrayList<>();

        for (MatchPlayer player : players.values()) {
            PlayerRound playerRound = player.round();
            if (playerRound.hasPosition()) {
                playerRound.close(finalPrice);
            }
            double score = playerRound.scoreAt(finalPrice);
            int liquidations = playerRound.liquidations();
            Rumor rumor = round.rumorFor(player.id());

            player.recordRoundScore(score);
            results.add(new RoundResult(
                    player.id(), player.nickname(), score, player.totalScore(),
                    liquidations, rumor.claimedRegime(), rumor.truthful(),
                    tipClaims.get(player.id())));
        }

        results.sort(Comparator.comparingDouble(RoundResult::totalScore).reversed());
        events.add(new GameEvent.RoundSettled(roundIndex, round.regime(), List.copyOf(results)));

        if (roundIndex + 1 < config.rounds()) {
            planRound(roundIndex + 1);
            enterIntermission(now, events);
        } else {
            phase = MatchPhase.FINISHED;
            phaseEndsAtMillis = now;
            events.add(new GameEvent.PhaseChanged(MatchPhase.FINISHED, roundIndex, now));
        }
    }

    private void planRound(int index) {
        roundIndex = index;
        round = planner.plan(matchSeed(), index, players.keySet(), config);
    }

    /** Same code and generation means the same market, which is what a replay rematch wants. */
    private long matchSeed() {
        return (code + ":" + generation).hashCode();
    }

    private void enterIntermission(long now, List<GameEvent> events) {
        phase = MatchPhase.INTERMISSION;
        phaseEndsAtMillis = now + config.intermissionMillis();
        events.add(new GameEvent.PhaseChanged(MatchPhase.INTERMISSION, roundIndex, phaseEndsAtMillis));
    }

    private void beginTrading(long now, List<GameEvent> events) {
        players.values().forEach(player -> player.beginRound(config.startingCash()));
        tipClaims.clear();
        phase = MatchPhase.TRADING;
        roundStartedAtMillis = now;
        phaseEndsAtMillis = now + config.roundMillis();
        newsFired = 0;
        events.add(new GameEvent.PhaseChanged(MatchPhase.TRADING, roundIndex, phaseEndsAtMillis));
    }

    // --- player actions ------------------------------------------------------

    public Position openPosition(String playerId, Side side, double sizeFraction, int leverage, long now) {
        return tradingRound(playerId).open(side, sizeFraction, leverage, currentPrice(now), now);
    }

    public double closePosition(String playerId, long now) {
        return tradingRound(playerId).close(currentPrice(now));
    }

    /**
     * Records what a player says their tip is. The last word counts: changing your story is
     * allowed, and being held to the version you finished on is the point.
     *
     * A null claim leaves any earlier one standing, so typing free text after using a
     * quick-chat line does not quietly retract it.
     */
    public void recordTipClaim(String playerId, Regime claimed) {
        if (claimed != null && phase == MatchPhase.TRADING && players.containsKey(playerId)) {
            tipClaims.put(playerId, claimed);
        }
    }

    private PlayerRound tradingRound(String playerId) {
        if (phase != MatchPhase.TRADING) {
            throw new IllegalStateException("The market is closed");
        }
        MatchPlayer player = players.get(playerId);
        if (player == null) {
            throw new IllegalArgumentException("Not in this match");
        }
        return player.round();
    }

    // --- reads ---------------------------------------------------------------

    /** During an intermission this is the upcoming round's opening price. */
    public double currentPrice(long now) {
        if (round == null) {
            return 0;
        }
        return phase == MatchPhase.TRADING
                ? round.priceAt(now - roundStartedAtMillis)
                : round.path().startPrice();
    }

    public List<Standing> standings() {
        List<MatchPlayer> ordered = new ArrayList<>(players.values());
        ordered.sort(Comparator.comparingDouble(MatchPlayer::totalScore)
                .thenComparingDouble(MatchPlayer::bestRound).reversed());

        List<Standing> standings = new ArrayList<>(ordered.size());
        for (int i = 0; i < ordered.size(); i++) {
            MatchPlayer player = ordered.get(i);
            standings.add(new Standing(
                    i + 1, player.id(), player.nickname(), player.totalScore(), player.bestRound()));
        }
        return List.copyOf(standings);
    }

    public Rumor rumorFor(String playerId) {
        return round == null ? null : round.rumorFor(playerId);
    }

    public String code() {
        return code;
    }

    public MatchConfig config() {
        return config;
    }

    public MatchPhase phase() {
        return phase;
    }

    public int roundIndex() {
        return roundIndex;
    }

    public long phaseEndsAtMillis() {
        return phaseEndsAtMillis;
    }

    /** The upcoming round during an intermission, the live one while trading. */
    public RoundPlan round() {
        return round;
    }

    public Collection<MatchPlayer> players() {
        return List.copyOf(players.values());
    }

    public MatchPlayer player(String playerId) {
        return players.get(playerId);
    }
}
