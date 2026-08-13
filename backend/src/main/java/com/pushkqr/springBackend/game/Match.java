package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.info.MarketEvent;
import com.pushkqr.springBackend.game.info.Rumor;
import com.pushkqr.springBackend.game.model.MatchConfig;
import com.pushkqr.springBackend.game.model.PlayerRound;
import com.pushkqr.springBackend.game.model.Position;
import com.pushkqr.springBackend.game.model.Side;

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

    public static final int MIN_PLAYERS = 2;

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
                    liquidations, rumor.claimedRegime(), rumor.truthful()));
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
        round = planner.plan(code, index, players.keySet(), config);
    }

    private void enterIntermission(long now, List<GameEvent> events) {
        phase = MatchPhase.INTERMISSION;
        phaseEndsAtMillis = now + config.intermissionMillis();
        events.add(new GameEvent.PhaseChanged(MatchPhase.INTERMISSION, roundIndex, phaseEndsAtMillis));
    }

    private void beginTrading(long now, List<GameEvent> events) {
        players.values().forEach(player -> player.beginRound(config.startingCash()));
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
