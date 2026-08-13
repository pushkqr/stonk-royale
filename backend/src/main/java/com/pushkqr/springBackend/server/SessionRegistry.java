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

    public void removeForMatch(String matchCode) {
        byToken.values().removeIf(session -> session.matchCode().equals(matchCode));
    }
}
