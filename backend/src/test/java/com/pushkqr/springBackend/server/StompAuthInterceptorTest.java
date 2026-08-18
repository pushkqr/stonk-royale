package com.pushkqr.springBackend.server;

import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StompAuthInterceptorTest {

    private final SessionRegistry sessions = new SessionRegistry();
    private final StompAuthInterceptor interceptor = new StompAuthInterceptor(sessions);

    @Test
    void aValidTokenAttachesItsSessionToTheSocket() {
        PlayerSession session = sessions.create("ABCD", "guest:device-1", "pappa");

        Message<byte[]> connect = connectWith(session.token());
        interceptor.preSend(connect, null);

        assertThat(MessageHeaderAccessor.getAccessor(connect, StompHeaderAccessor.class).getUser())
                .isEqualTo(session);
    }

    /**
     * The literal here is deliberately not read from StompAuthInterceptor.SEAT_EXPIRED.
     * This is the string the browser matches on to decide a seat is unrecoverable, and a
     * test that referenced the constant would keep passing through exactly the rename that
     * breaks reconnection. frontend/src/test/stompError.test.js asserts the same literal
     * from the other end.
     */
    @Test
    void anUnknownTokenIsRejectedWithTheCodeTheClientMatches() {
        assertThatThrownBy(() -> interceptor.preSend(connectWith("not-a-real-token"), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("SEAT_EXPIRED");
    }

    @Test
    void aConnectCarryingNoTokenAtAllIsRejectedTheSameWay() {
        assertThatThrownBy(() -> interceptor.preSend(connectWith(null), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("SEAT_EXPIRED");
    }

    /**
     * Left mutable because that is how the real STOMP pipeline hands a CONNECT to the
     * interceptor, and it is what lets setUser succeed; headers that have been sealed throw
     * instead. The channel argument is unused by preSend, so null is honest here.
     */
    private Message<byte[]> connectWith(String token) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setLeaveMutable(true);
        if (token != null) {
            accessor.setNativeHeader(StompAuthInterceptor.TOKEN_HEADER, token);
        }
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
