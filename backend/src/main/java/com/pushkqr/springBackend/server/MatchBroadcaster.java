package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.GameEvent;
import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.MatchPhase;
import com.pushkqr.springBackend.game.MatchPlayer;
import com.pushkqr.springBackend.game.RoundPlan;
import com.pushkqr.springBackend.game.info.Rumor;
import com.pushkqr.springBackend.game.model.PlayerRound;
import com.pushkqr.springBackend.game.model.Position;
import com.pushkqr.springBackend.game.sim.MarketImpact;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/** Owns every topic name and every model-to-wire conversion, so nothing else has to. */
@Component
public class MatchBroadcaster {

    private final SimpMessagingTemplate template;

    public MatchBroadcaster(SimpMessagingTemplate template) {
        this.template = template;
    }

    public void phase(Match match) {
        send(match, "phase", phaseView(match));
    }

    public void ready(Match match) {
        send(match, "ready", new Views.Ready(match.readyCount(), match.players().size()));
    }

    public void price(Match match, long now) {
        send(match, "price", new Views.Price(
                match.currentPrice(now), now - roundElapsedBase(match, now)));
    }

    public void board(Match match, long now) {
        double price = match.currentPrice(now);
        List<Views.BoardRow> rows = match.players().stream()
                .map(player -> boardRow(player, price))
                .sorted((a, b) -> Double.compare(b.equity(), a.equity()))
                .toList();
        send(match, "board", rows);
    }

    public void feed(Match match, String kind, String text, String playerId, String nickname) {
        send(match, "feed", new Views.Feed(kind, text, playerId, nickname));
    }

    public void settled(Match match, GameEvent.RoundSettled event) {
        List<Views.RoundResult> results = event.results().stream()
                .map(r -> new Views.RoundResult(
                        r.playerId(), r.nickname(), round2(r.roundScore()), round2(r.totalScore()),
                        r.liquidations(), r.rumorClaimed().name(), r.rumorWasTrue(),
                        r.claimedTipAs() == null ? null : r.claimedTipAs().name(),
                        isBot(match, r.playerId())))
                .toList();
        send(match, "settled", new Views.Settled(event.roundIndex(), event.regime().name(), results));
    }

    public void standings(Match match) {
        List<Views.Standing> standings = match.standings().stream()
                .map(s -> new Views.Standing(s.rank(), s.playerId(), s.nickname(),
                        round2(s.totalScore()), round2(s.bestRound()), isBot(match, s.playerId())))
                .toList();
        send(match, "standings", standings);
    }

    /** Resolved by id because the game-side result records carry no seat, only a player. */
    private boolean isBot(Match match, String playerId) {
        MatchPlayer player = match.player(playerId);
        return player != null && player.isBot();
    }

    public void lobby(Match match) {
        send(match, "lobby", lobbyView(match));
    }

    /**
     * Rumors go to each player individually — the entire mechanic collapses if they land
     * on a shared topic.
     */
    public void rumors(Match match) {
        for (MatchPlayer player : match.players()) {
            rumor(match, player.id());
        }
    }

    /**
     * One player's tip, for a resync. Deliberately not the whole room: a reconnect that
     * re-dealt everyone would cue the deal sound for players who never left.
     */
    public void rumor(Match match, String playerId) {
        Rumor rumor = match.rumorFor(playerId);
        if (rumor != null) {
            template.convertAndSendToUser(
                    playerId, "/queue/rumor",
                    new Views.Rumor(rumor.text(), rumor.claimedRegime().name()));
        }
    }

    /**
     * Tells one player they are out, so their client can stand down instead of retrying a
     * token the server has already dropped.
     */
    public void kicked(String playerId) {
        template.convertAndSendToUser(playerId, "/queue/kicked", Map.of("kicked", true));
    }

    // --- views ---------------------------------------------------------------

    public Views.Lobby lobbyView(Match match) {
        return new Views.Lobby(
                match.code(),
                match.phase().name(),
                match.config().rounds(),
                match.config().roundSeconds(),
                match.config().intermissionSeconds(),
                match.config().startingCash(),
                match.config().maxPlayers(),
                match.players().stream()
                        .map(p -> new Views.LobbyPlayer(p.id(), p.nickname(), p.isHost(), p.isBot(), p.isConnected()))
                        .toList(),
                match.isPublic(),
                new Views.Impact(MarketImpact.IMPACT_PER_TRADE, match.referenceNotional()));
    }

    /**
     * Below this the count stops being a shared clue and becomes a private answer: tell a
     * lone player that one tip is true and they know it is theirs.
     */
    private static final int MIN_PLAYERS_FOR_TIP_COUNT = 2;

    private Views.Phase phaseView(Match match) {
        RoundPlan round = match.round();
        Views.Asset asset = round == null ? null : new Views.Asset(
                round.asset().ticker(), round.asset().blurb(), round.path().startPrice());

        Integer truthfulTips = round == null || match.players().size() < MIN_PLAYERS_FOR_TIP_COUNT
                ? null
                : round.truthfulTipCount();

        return new Views.Phase(
                match.phase().name(),
                match.roundIndex(),
                match.config().rounds(),
                match.phaseEndsAtMillis(),
                System.currentTimeMillis(),
                asset,
                truthfulTips);
    }

    private Views.BoardRow boardRow(MatchPlayer player, double price) {
        PlayerRound round = player.round();
        if (round == null) {
            return new Views.BoardRow(player.id(), player.nickname(), 0, 0,
                    round2(player.totalScore()), null, player.isBot(), false, 0);
        }
        return new Views.BoardRow(
                player.id(),
                player.nickname(),
                round2(round.equity(price)),
                round2(round.scoreAt(price)),
                round2(player.totalScore()),
                positionView(round, price),
                player.isBot(),
                true,
                round2(round.cash()));
    }

    private Views.Position positionView(PlayerRound round, double price) {
        Position position = round.position();
        if (position == null) {
            return null;
        }
        return new Views.Position(
                position.side().name(),
                round2(position.margin()),
                position.leverage(),
                position.entryPrice(),
                position.liquidationPrice(),
                round2(position.unrealisedPnl(price)));
    }

    private long roundElapsedBase(Match match, long now) {
        return match.phase() == MatchPhase.TRADING
                ? match.phaseEndsAtMillis() - match.config().roundMillis()
                : now;
    }

    private void send(Match match, String channel, Object payload) {
        template.convertAndSend("/topic/match/" + match.code() + "/" + channel, payload);
    }

    /** Money and scores are rounded once, here, so float noise never reaches a screen. */
    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
