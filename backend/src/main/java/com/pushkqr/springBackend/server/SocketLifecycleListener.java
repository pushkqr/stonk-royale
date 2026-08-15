package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.Match;
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
    private final MatchBroadcaster broadcaster;

    public SocketLifecycleListener(MatchRegistry matches, MatchBroadcaster broadcaster) {
        this.matches = matches;
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
        if (match != null && match.markConnected(session.playerId(), true, System.currentTimeMillis())) {
            // Only on a real change: the usual case is the socket that follows a join, and
            // that join has already broadcast this roster. Re-sending it would double every
            // join's traffic to say nothing new.
            broadcaster.lobby(match);
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

        // Every phase treated alike now. A dropped socket is not a departure in any of them:
        // a refresh, a tunnel and a closed tab are indistinguishable from here, and freeing
        // the seat immediately meant reloading the lobby page threw you out of the room —
        // taking your token with it, so the reconnect could not even be authenticated.
        // Task 3's grace timer is what eventually clears a seat nobody comes back to.
        if (match.markConnected(session.playerId(), false, System.currentTimeMillis())) {
            // Without this the flag moved and nobody heard. Views.LobbyPlayer has carried
            // `connected` and Lobby.jsx has drawn an "away" badge from it since they were
            // written, but no broadcast followed the change — so the badge never appeared
            // once, and a closed window looked exactly like a healthy seat for the full
            // 45 seconds until SeatVacated finally said otherwise.
            broadcaster.lobby(match);
        }
        logger.debug("{} dropped in match {}", session.playerId(), match.code());
    }
}
