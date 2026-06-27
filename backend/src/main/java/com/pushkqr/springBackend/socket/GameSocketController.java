package com.pushkqr.springBackend.socket;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Map;

@Controller
public class GameSocketController {

    @MessageMapping("/ping")
    public void handlePing(Principal principal){
        System.out.println("User " + principal.getName() + " pinged the server");
    }

}
