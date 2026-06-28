package com.pushkqr.springBackend.socket;

import com.pushkqr.springBackend.dto.ChatMessage;
import com.pushkqr.springBackend.services.RoomService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.Map;

@Controller
public class GameSocketController {
    private static final Logger logger = LoggerFactory.getLogger(GameSocketController.class);

    private SimpMessagingTemplate messagingTemplate;
    private RoomService roomService;

    @Autowired
    public GameSocketController(SimpMessagingTemplate messagingTemplate, RoomService roomService) {
        this.messagingTemplate = messagingTemplate;
        this.roomService = roomService;
    }

    @MessageMapping("/ping")
    public void handlePing(Principal principal){
        if (principal != null) {
            logger.info("User {} pinged the server", principal.getName());
        }
    }

    @MessageMapping("/chat/{roomCode}")
    public void handleChat(@DestinationVariable String roomCode, ChatMessage message){
        message.setTimsetamp(OffsetDateTime.now());
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/chat", message);
    }

    @MessageMapping("/ready/{roomCode}")
    public void handleReadyUp(@DestinationVariable String roomCode, Principal principal){
        String uid = principal.getName();

        roomService.readyUpPlayer(uid, roomCode);

        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/readyStatus", (Object) Map.of("userId", uid, "isReady", true));

    }
}
