package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.exceptions.MatchNotFoundException;
import com.pushkqr.springBackend.game.Avatars;
import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.MatchPhase;
import com.pushkqr.springBackend.game.model.MatchConfig;
import com.pushkqr.springBackend.game.model.Modifier;
import com.pushkqr.springBackend.game.model.Position;
import com.pushkqr.springBackend.game.model.Side;
import com.pushkqr.springBackend.game.sim.Regime;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Locale;
import java.util.Map;

@Controller
public class MatchSocketController {

    private final MatchRegistry matches;
    private final MatchBroadcaster broadcaster;
    private final SessionRegistry sessions;
    private final ChatLimiter chatLimiter;

    public MatchSocketController(MatchRegistry matches, MatchBroadcaster broadcaster,
            SessionRegistry sessions, ChatLimiter chatLimiter) {
        this.matches = matches;
        this.broadcaster = broadcaster;
        this.sessions = sessions;
        this.chatLimiter = chatLimiter;
    }

    @MessageMapping("/match/{code}/start")
    public void start(@DestinationVariable String code, Principal principal) {
        Match match = require(code, principal);
        requireHost(match, session(principal).playerId(), "start the match");

        match.start(System.currentTimeMillis());
        broadcaster.phase(match);
        broadcaster.ready(match);
    }

    /**
     * Says this player has read the briefing. The phase is not advanced here — the tick
     * loop owns every transition and will pick this up within 100ms.
     */
    @MessageMapping("/match/{code}/ready")
    public void ready(@DestinationVariable String code, Principal principal) {
        Match match = require(code, principal);
        if (match.markReady(session(principal).playerId())) {
            broadcaster.ready(match);
        }
    }

    /**
     * Reopens a finished room for another match. Everyone keeps their seat and socket, so
     * the group never gets scattered back to the home page between matches.
     */
    @MessageMapping("/match/{code}/rematch")
    public void rematch(@DestinationVariable String code, @Payload Requests.Rematch request,
            Principal principal) {
        Match match = require(code, principal);
        requireHost(match, session(principal).playerId(), "start a rematch");

        match.rematch(request.sameMarket(), System.currentTimeMillis());
        broadcaster.phase(match);
        broadcaster.lobby(match);
        // Scores are back to zero, and without this the table carries the old match's
        // totals into the new one until its first round settles.
        broadcaster.standings(match);
    }

    /**
     * Gives up a seat for good. Sent when someone actually clicks Leave — never on a
     * dropped socket, which is usually just a phone locking its screen.
     *
     * Standings are deliberately not re-sent: the podium on screen is the record of the
     * match that was played, and rewriting it out from under the people still reading it
     * would erase a result that really happened.
     */
    @MessageMapping("/match/{code}/leave")
    public void leave(@DestinationVariable String code, Principal principal) {
        Match match = require(code, principal);
        if (!match.leave(session(principal).playerId(), System.currentTimeMillis())) {
            return;
        }

        if (match.hasNoHumans()) {
            matches.remove(code);
            return;
        }
        broadcaster.lobby(match);
    }

    /**
     * Host clears a seat from the waiting room.
     *
     * Lobby only: once a match is running, seats are kept on purpose and yanking one would
     * take a live player out of a round. Not a ban — the code still works and they can
     * come back through the invite link.
     */
    @MessageMapping("/match/{code}/kick")
    public void kick(@DestinationVariable String code, @Payload Requests.Kick request,
            Principal principal) {
        Match match = require(code, principal);
        PlayerSession actor = session(principal);

        requireHost(match, actor.playerId(), "remove a player");
        if (match.phase() != MatchPhase.LOBBY) {
            throw new IllegalStateException("Players can only be removed before the match starts");
        }
        if (actor.playerId().equals(request.playerId())) {
            throw new IllegalStateException("You cannot remove yourself — use Leave");
        }
        if (!match.leave(request.playerId(), System.currentTimeMillis())) {
            return;
        }

        broadcaster.kicked(request.playerId());
        sessions.remove(sessionTokenOf(request.playerId()));
        broadcaster.lobby(match);
    }

    /**
     * Host adds an opponent to the waiting room.
     *
     * Lobby only, for the same reason kick is: the roster a round was planned for must not
     * change underneath it. Removal is kick's job — it already clears a bot as readily as
     * a person, so there is no separate path for taking one back out.
     */
    @MessageMapping("/match/{code}/bot")
    public void bot(@DestinationVariable String code, Principal principal) {
        Match match = require(code, principal);
        requireHost(match, session(principal).playerId(), "add a bot");
        if (match.phase() != MatchPhase.LOBBY) {
            throw new IllegalStateException("Bots can only be added before the match starts");
        }

        Bots.seat(match);
        broadcaster.lobby(match);
    }

    /**
     * Host retunes the room from the lobby. Bounds are enforced by MatchConfig's own
     * constructor, so a bad value surfaces as an error to the host rather than a bad match.
     */
    @MessageMapping("/match/{code}/config")
    public void config(@DestinationVariable String code, @Payload Requests.Config request,
            Principal principal) {
        Match match = require(code, principal);
        requireHost(match, session(principal).playerId(), "change the settings");

        double volatility = request.volatilityMultiplier() == null ? 1.0 : request.volatilityMultiplier();
        double marketImpact = request.marketImpactMultiplier() == null ? 1.0 : request.marketImpactMultiplier();
        match.updateConfig(new MatchConfig(
                request.rounds(), request.roundSeconds(), request.intermissionSeconds(),
                request.startingCash(), request.maxPlayers(), volatility, marketImpact,
                Modifier.parse(request.modifier())));
        match.setVisibility(request.isPublic());
        broadcaster.lobby(match);
    }

    /**
     * Re-sends current state on connect. Phase messages only fire on transitions, so
     * without this a player who reloads mid-round sees nothing until the next one.
     */
    @MessageMapping("/match/{code}/sync")
    public void sync(@DestinationVariable String code, Principal principal) {
        Match match = require(code, principal);
        // Resyncing means their socket is back up — clears any disconnect recorded while
        // they were away, so they count against the briefing gate again.
        match.markConnected(session(principal).playerId(), true, System.currentTimeMillis());
        broadcaster.lobby(match);
        broadcaster.standings(match);
        broadcaster.ready(match);
        if (match.round() != null) {
            broadcaster.phase(match);
            // The tip is dealt once, on the intermission it belongs to. Without this a
            // reload leaves the dossier's tip empty for the rest of the round.
            broadcaster.rumor(match, session(principal).playerId());
        }
    }

    @MessageMapping("/match/{code}/open")
    public void open(@DestinationVariable String code, @Payload Requests.Open request, Principal principal) {
        Match match = require(code, principal);
        PlayerSession session = session(principal);
        Side side = parseSide(request.side());
        long now = System.currentTimeMillis();

        Position position = match.openPosition(
                session.playerId(), side, request.sizeFraction(), request.leverage(),
                now);

        broadcaster.feed(match, "TRADE",
                String.format("%s went %dx %s @ %s",
                        session.nickname(), position.leverage(), side, Text.price(position.entryPrice())),
                session.playerId(), session.nickname());
        broadcaster.price(match, now);
        broadcaster.board(match, now);
    }

    @MessageMapping("/match/{code}/close")
    public void close(@DestinationVariable String code, Principal principal) {
        Match match = require(code, principal);
        PlayerSession session = session(principal);
        long now = System.currentTimeMillis();

        double pnl = match.closePosition(session.playerId(), now);

        broadcaster.feed(match, "TRADE",
                String.format("%s closed for %s$%,.0f", session.nickname(), pnl >= 0 ? "+" : "-", Math.abs(pnl)),
                session.playerId(), session.nickname());
        broadcaster.price(match, now);
        broadcaster.board(match, now);
    }

    @MessageMapping("/match/{code}/chat")
    public void chat(@DestinationVariable String code, @Payload Requests.Chat request, Principal principal) {
        Match match = require(code, principal);
        PlayerSession session = session(principal);

        String text = Text.chat(request.text());
        if (text.isEmpty()) {
            return;
        }
        // Silently, and before the claim is recorded: a dropped line must not move the
        // player's claimed tip either, or the limiter becomes a way to change what you told
        // the room without the room seeing you say it.
        if (!chatLimiter.allow(code, session.playerId(), System.currentTimeMillis())) {
            return;
        }
        match.recordTipClaim(session.playerId(), parseClaim(request.claim()));
        broadcaster.feed(match, "CHAT", text, session.playerId(), session.nickname());
    }

    /**
     * The avatar picker lives in the lobby, so a player can change their mark after they are
     * already seated. Without this the change would only reach the room on a rejoin.
     */
    @MessageMapping("/match/{code}/avatar")
    public void avatar(@DestinationVariable String code, @Payload Requests.Avatar request,
            Principal principal) {
        Match match = require(code, principal);
        PlayerSession session = session(principal);
        if (match.setAvatar(session.playerId(), Avatars.sanitise(request.avatar()))) {
            broadcaster.lobby(match);
            broadcaster.board(match, System.currentTimeMillis());
        }
    }

    /** An unreadable claim is not worth rejecting a message over — it just goes unscored. */
    private Regime parseClaim(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            return Regime.valueOf(raw.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Failures go back to the one player who caused them, not the whole room. */
    @MessageExceptionHandler
    @SendToUser("/queue/error")
    public Map<String, String> handleError(Exception e) {
        return Map.of("error", e.getMessage() == null ? "Something went wrong" : e.getMessage());
    }

    private Match require(String code, Principal principal) {
        PlayerSession session = session(principal);
        if (!session.matchCode().equalsIgnoreCase(code)) {
            throw new IllegalStateException("Not a player in this match");
        }
        Match match = matches.get(code);
        if (match == null) {
            throw new MatchNotFoundException("No match with code " + code);
        }
        return match;
    }

    private PlayerSession session(Principal principal) {
        if (principal instanceof PlayerSession session) {
            return session;
        }
        throw new IllegalStateException("Not authenticated — reconnect with a valid token");
    }

    private Side parseSide(String raw) {
        try {
            return Side.valueOf(raw.toUpperCase(Locale.ROOT));
        } catch (Exception e) {
            throw new IllegalArgumentException("Side must be LONG or SHORT");
        }
    }

    private void requireHost(Match match, String playerId, String actionDescription) {
        // Through Match rather than off a live player: `host` is a plain boolean that moves
        // when the host leaves, and reading it from this thread without the monitor could
        // miss a promotion and refuse the new host their own controls.
        if (!match.isHost(playerId)) {
            throw new IllegalStateException("Only the host can " + actionDescription);
        }
    }

    /** The kicked player's token, so their socket cannot reconnect onto a freed seat. */
    private String sessionTokenOf(String playerId) {
        return sessions.tokenFor(playerId);
    }
}
