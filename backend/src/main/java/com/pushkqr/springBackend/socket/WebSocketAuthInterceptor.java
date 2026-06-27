package com.pushkqr.springBackend.socket;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import org.jspecify.annotations.Nullable;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.Collections;

@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if(accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())){
            String token = accessor.getFirstNativeHeader("Authorization");

            if(token != null && token.startsWith("Bearer ")){
                try{
                    String idToken = token.replace("Bearer ", "");
                    FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(idToken);

                    UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(decodedToken.getUid(), null, Collections.emptyList());

                    accessor.setUser(auth);

                }catch (Exception e){
                    throw new IllegalArgumentException("Invalid Firebase Token in WebSocket");
                }
            }
        }

        return message;
    }
}
