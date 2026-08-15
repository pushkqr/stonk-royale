package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.MatchPhase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

/**
 * Notices when a socket goes away.
 *
 * Until this existed, closing a browser window left the player sitting in the match
 * forever: nothing but a deliberate Leave ever freed a seat. In the lobby that produced a
 * ghost — the same person rejoining got a fresh guest id and a second seat — and during
 * the briefing the ghost could never ready up, so the whole room waited out the failsafe.
 */
@Component
public class SocketLifecycleListener {

    private static final Logger logger = LoggerFactory.getLogger(SocketLifecycleListener.class);

    private final MatchRegistry matches;
    private final SessionRegistry sessions;
    private final MatchBroadcaster broadcaster;

    public SocketLifecycleListener(MatchRegistry matches, SessionRegistry sessions,
            MatchBroadcaster broadcaster) {
        this.matches = matches;
        this.sessions = sessions;
        this.broadcaster = broadcaster;
    }

    /**
     * A socket finished its STOMP handshake.
     *
     * Seats are handed out over HTTP and the socket opens some time later, so this is the
     * first moment the server knows somebody is really there. Without it a seat stays marked
     * absent and the reaper would eventually clear a room with people sitting in it.
     */
    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        Principal user = StompHeaderAccessor.wrap(event.getMessage()).getUser();
        if (!(user instanceof PlayerSession session)) {
            return;
        }
        Match match = matches.get(session.matchCode());
        if (match != null) {
            match.markConnected(session.playerId(), true);
        }
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        Principal user = StompHeaderAccessor.wrap(event.getMessage()).getUser();
        if (!(user instanceof PlayerSession session)) {
            return;
        }

        Match match = matches.get(session.matchCode());
        if (match == null) {
            return;
        }

        // Before a match starts — or once it is over — a dropped socket really is a
        // departure, and holding the seat only strands it. Mid-match the seat is kept on
        // purpose; see Match.leave's javadoc.
        if (match.phase() == MatchPhase.LOBBY || match.phase() == MatchPhase.FINISHED) {
            if (match.leave(session.playerId())) {
                sessions.remove(session.token());
                if (match.hasNoHumans()) {
                    matches.remove(match.code());
                    return;
                }
                broadcaster.lobby(match);
            }
            return;
        }

        // Mid-match: keep the seat, but stop them holding the briefing gate shut.
        match.markConnected(session.playerId(), false);
        logger.debug("{} dropped in match {}", session.playerId(), match.code());
    }
}
