package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.GameEvent;
import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.MatchPhase;
import com.pushkqr.springBackend.game.PlayerSnapshot;
import com.pushkqr.springBackend.game.RoundPlan;
import com.pushkqr.springBackend.game.info.Rumor;
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
        Views.Phase view;
        synchronized (match) {
            view = phaseView(match);
        }
        send(match, "phase", view);
    }

    public void ready(Match match) {
        Views.Ready view;
        synchronized (match) {
            view = new Views.Ready(match.readyCount(), match.playerCount());
        }
        send(match, "ready", view);
    }

    public void price(Match match, long now) {
        Views.Price view;
        synchronized (match) {
            view = new Views.Price(
                    match.currentPrice(now), now - roundElapsedBase(match, now));
        }
        send(match, "price", view);
    }

    public void board(Match match, long now) {
        List<PlayerSnapshot> snapshots = match.playerSnapshots(now);
        List<Views.BoardRow> rows = snapshots.stream()
                .map(this::boardRow)
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
                        match.isBot(r.playerId())))
                .toList();
        send(match, "settled", new Views.Settled(event.roundIndex(), event.regime().name(), results));
    }

    public void standings(Match match) {
        List<Views.Standing> standings = match.standings().stream()
                .map(s -> new Views.Standing(s.rank(), s.playerId(), s.nickname(),
                        round2(s.totalScore()), round2(s.bestRound()), match.isBot(s.playerId())))
                .toList();
        send(match, "standings", standings);
    }

    public void lobby(Match match) {
        Views.Lobby view;
        synchronized (match) {
            view = lobbyView(match);
        }
        send(match, "lobby", view);
    }

    /**
     * Rumors go to each player individually — the entire mechanic collapses if they land
     * on a shared topic.
     */
    public void rumors(Match match) {
        for (String playerId : match.playerIds()) {
            rumor(match, playerId);
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
                match.playerSnapshots(System.currentTimeMillis()).stream()
                        .map(p -> new Views.LobbyPlayer(p.id(), p.nickname(), p.host(), p.bot(), p.connected(), p.avatar()))
                        .toList(),
                match.isPublic(),
                new Views.Impact(
                        MarketImpact.IMPACT_PER_TRADE * match.config().marketImpactMultiplier(),
                        match.referenceNotional(),
                        match.config().marketImpactMultiplier()),
                match.config().volatilityMultiplier(),
                match.config().marketImpactMultiplier(),
                match.config().modifier().name(),
                match.config().modifier().label(),
                match.config().modifier().blurb());
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

        Integer truthfulTips = round == null || match.playerCount() < MIN_PLAYERS_FOR_TIP_COUNT
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

    Views.BoardRow boardRow(PlayerSnapshot player) {
        if (!player.inRound()) {
            return new Views.BoardRow(player.id(), player.nickname(), 0, 0,
                    round2(player.totalScore()), null, player.bot(), false, 0,
                    player.left(), player.avatar());
        }
        return new Views.BoardRow(
                player.id(),
                player.nickname(),
                round2(player.equity()),
                round2(player.scoreAt()),
                round2(player.totalScore()),
                positionView(player.position()),
                player.bot(),
                true,
                round2(player.cash()),
                player.left(),
                player.avatar());
    }

    private Views.Position positionView(PlayerSnapshot.Open position) {
        if (position == null) {
            return null;
        }
        return new Views.Position(
                position.side(),
                round2(position.margin()),
                position.leverage(),
                position.entryPrice(),
                position.liquidationPrice(),
                round2(position.unrealisedPnl()));
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
