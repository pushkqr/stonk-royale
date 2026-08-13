package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.exceptions.MatchNotFoundException;
import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.model.Position;
import com.pushkqr.springBackend.game.model.Side;
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

    public MatchSocketController(MatchRegistry matches, MatchBroadcaster broadcaster) {
        this.matches = matches;
        this.broadcaster = broadcaster;
    }

    @MessageMapping("/match/{code}/start")
    public void start(@DestinationVariable String code, Principal principal) {
        Match match = require(code, principal);
        if (!match.player(session(principal).playerId()).isHost()) {
            throw new IllegalStateException("Only the host can start the match");
        }

        match.start(System.currentTimeMillis());
        broadcaster.phase(match);
        broadcaster.rumors(match);
    }

    /**
     * Re-sends current state on connect. Phase messages only fire on transitions, so
     * without this a player who reloads mid-round sees nothing until the next one.
     */
    @MessageMapping("/match/{code}/sync")
    public void sync(@DestinationVariable String code, Principal principal) {
        Match match = require(code, principal);
        broadcaster.lobby(match);
        broadcaster.standings(match);
        if (match.round() != null) {
            broadcaster.phase(match);
        }
    }

    @MessageMapping("/match/{code}/open")
    public void open(@DestinationVariable String code, @Payload Requests.Open request, Principal principal) {
        Match match = require(code, principal);
        PlayerSession session = session(principal);
        Side side = parseSide(request.side());

        Position position = match.openPosition(
                session.playerId(), side, request.sizeFraction(), request.leverage(),
                System.currentTimeMillis());

        broadcaster.feed(match, "TRADE",
                String.format("%s went %dx %s @ %s",
                        session.nickname(), position.leverage(), side, price(position.entryPrice())),
                session.playerId(), session.nickname());
    }

    @MessageMapping("/match/{code}/close")
    public void close(@DestinationVariable String code, Principal principal) {
        Match match = require(code, principal);
        PlayerSession session = session(principal);

        double pnl = match.closePosition(session.playerId(), System.currentTimeMillis());

        broadcaster.feed(match, "TRADE",
                String.format("%s closed for %s$%,.0f", session.nickname(), pnl >= 0 ? "+" : "-", Math.abs(pnl)),
                session.playerId(), session.nickname());
    }

    @MessageMapping("/match/{code}/chat")
    public void chat(@DestinationVariable String code, @Payload Requests.Chat request, Principal principal) {
        Match match = require(code, principal);
        PlayerSession session = session(principal);

        String text = Text.chat(request.text());
        if (!text.isEmpty()) {
            broadcaster.feed(match, "CHAT", text, session.playerId(), session.nickname());
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

    /** Sub-dollar assets need more decimals than a stock ticker would. */
    private static String price(double value) {
        return value >= 1 ? String.format("$%,.2f", value) : String.format("$%.4f", value);
    }
}
