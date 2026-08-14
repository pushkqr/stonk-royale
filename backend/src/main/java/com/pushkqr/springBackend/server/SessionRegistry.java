package com.pushkqr.springBackend.server;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SessionRegistry {

    private final Map<String, PlayerSession> byToken = new ConcurrentHashMap<>();

    public PlayerSession create(String matchCode, String playerId, String nickname) {
        PlayerSession session = new PlayerSession(
                UUID.randomUUID().toString(), playerId, nickname, matchCode);
        byToken.put(session.token(), session);
        return session;
    }

    public PlayerSession byToken(String token) {
        return token == null ? null : byToken.get(token);
    }

    /** Drops one seat's token, so a removed player's socket cannot reconnect onto it. */
    public void remove(String token) {
        if (token != null) {
            byToken.remove(token);
        }
    }

    /** Finds a live token by player id. Null when that player has no session. */
    public String tokenFor(String playerId) {
        return byToken.values().stream()
                .filter(session -> session.playerId().equals(playerId))
                .map(PlayerSession::token)
                .findFirst()
                .orElse(null);
    }

    public void removeForMatch(String matchCode) {
        byToken.values().removeIf(session -> session.matchCode().equals(matchCode));
    }
}
