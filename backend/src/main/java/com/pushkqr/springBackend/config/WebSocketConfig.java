package com.pushkqr.springBackend.config;

import com.pushkqr.springBackend.server.StompAuthInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;
import org.springframework.web.socket.messaging.StompSubProtocolErrorHandler;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompAuthInterceptor authInterceptor;
    private final String allowedOrigins;

    public WebSocketConfig(StompAuthInterceptor authInterceptor,
            @Value("${stonk.allowed-origins:*}") String allowedOrigins) {
        this.authInterceptor = authInterceptor;
        this.allowedOrigins = allowedOrigins;
    }

    /**
     * Heartbeats need a scheduler of their own; the simple broker will not send them without
     * one, and silently ignores any heartbeat value if none is set.
     */
    @Bean
    public TaskScheduler brokerHeartbeatScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("stomp-heartbeat-");
        scheduler.initialize();
        return scheduler;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue")
                // The client asks for ten seconds each way and, until this existed, the
                // broker quietly declined. A socket that dies without closing cleanly — a
                // slept laptop, a phone off wifi — was then never noticed at all, so the
                // disconnect handling below it never ran and the seat was held forever.
                .setHeartbeatValue(new long[] { 10_000, 10_000 })
                .setTaskScheduler(brokerHeartbeatScheduler());
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/api/ws")
                .setAllowedOriginPatterns(allowedOrigins.split(","));
        registry.setErrorHandler(new StompSubProtocolErrorHandler() {
            @Override
            public Message<byte[]> handleClientMessageProcessingError(
                    Message<byte[]> clientMessage, Throwable ex) {
                Throwable root = ex;
                while (root.getCause() != null && root.getCause() != root) {
                    root = root.getCause();
                }
                StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.ERROR);
                String msg = root.getMessage() != null ? root.getMessage() : "Connection error";
                accessor.setMessage(msg);
                accessor.setLeaveMutable(true);
                return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
            }
        });
    }

    /**
     * Limits on a single slow consumer, so that they stay a single slow consumer.
     *
     * With no send buffer limit — the default — a client that has stopped draining its
     * socket accumulates frames in heap at twelve a second per seat, and occupies a shared
     * executor while doing it. That is how one player on bad wifi becomes a stutter in
     * every room on the server. Past these limits the session is closed instead, and the
     * 45-second seat grace plus the client's own reconnect turn it into a blip for one
     * player rather than a slowdown for everybody.
     *
     * The heartbeats configured above catch a connection that has died. These catch one
     * that is alive but cannot keep up, which a heartbeat reads as perfectly healthy.
     */
    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        // Roughly a few seconds of frames for one player. Past this they are not behind,
        // they are gone.
        registration.setSendBufferSizeLimit(256 * 1024);
        // A single send that has not completed in ten seconds is not going to.
        registration.setSendTimeLimit(10_000);
        // Nothing a client legitimately sends is large; a chat line is the biggest of them.
        registration.setMessageSizeLimit(32 * 1024);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authInterceptor);
    }

    /**
     * Two vCPUs, so a larger pool would only add contention. The bounded queue is the
     * point: unbounded, a burst is absorbed into heap and paid back as latency spread
     * across every room on the box.
     */
    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        registration.taskExecutor().corePoolSize(2).maxPoolSize(4).queueCapacity(2_000);
    }
}
