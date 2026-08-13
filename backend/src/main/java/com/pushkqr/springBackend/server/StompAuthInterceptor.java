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
                throw new IllegalArgumentException("Unknown or expired session token");
            }
            accessor.setUser(session);
        }
        return message;
    }
}
