package com.pushkqr.springBackend.server;

import java.security.Principal;

/**
 * A player's claim on a seat.
 *
 * The token is what proves a socket message really comes from that player. Without it a
 * client could simply send someone else's id and trade on their behalf, since guests have
 * no account to authenticate against.
 */
public record PlayerSession(String token, String playerId, String nickname, String matchCode)
        implements Principal {

    @Override
    public String getName() {
        return playerId;
    }
}
