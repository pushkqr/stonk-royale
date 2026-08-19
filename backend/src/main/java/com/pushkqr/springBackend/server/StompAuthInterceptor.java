package com.pushkqr.springBackend.server;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * Attaches the join token's session to the socket at CONNECT.
 *
 * From then on every message carries a verified identity, so a client cannot trade or
 * chat as another player by simply claiming their id. It also gives Spring a Principal,
 * which is what makes per-player rumor delivery possible.
 */
@Component
public class StompAuthInterceptor implements ChannelInterceptor {

    static final String TOKEN_HEADER = "token";

    /**
     * The wire contract with the browser for a seat that cannot be recovered.
     *
     * WebSocketConfig's STOMP error handler unwraps to the root cause and copies its
     * message into the ERROR frame untouched, so this literal is what the client actually
     * reads. It is what decides whether the client throws its stored seat away and starts
     * over or keeps retrying a token that will never work again — which makes rewording
     * this a functional change, not a cosmetic one. Pinned by a test here and by a second
     * one in frontend/src/test/stompError.test.js, both spelling it out in full.
     */
    static final String SEAT_EXPIRED = "SEAT_EXPIRED";

    private final SessionRegistry sessions;

    public StompAuthInterceptor(SessionRegistry sessions) {
        this.sessions = sessions;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            PlayerSession session = sessions.byToken(accessor.getFirstNativeHeader(TOKEN_HEADER));
            if (session == null) {
                throw new IllegalArgumentException(
                        SEAT_EXPIRED + ": unknown or expired session token");
            }
            accessor.setUser(session);
        }
        return message;
    }
}
