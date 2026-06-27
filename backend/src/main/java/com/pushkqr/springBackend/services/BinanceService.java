package com.pushkqr.springBackend.services;

import com.pushkqr.springBackend.state.GameStateService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import javax.annotation.PostConstruct;

@Service
public class BinanceService extends TextWebSocketHandler {
    private final GameStateService gameStateService;
    private final ObjectMapper objectMapper;
    private final SimpMessagingTemplate messagingTemplate;
    private static final String BINANCE_WS_URL = "wss://stream.binance.com:9443/ws/btcusdt@miniTicker/ethusdt@miniTicker/solusdt@miniTicker/dogeusdt@miniTicker";

    @Autowired
    public BinanceService(GameStateService gameStateService, ObjectMapper objectMapper, SimpMessagingTemplate messagingTemplate) {
        this.gameStateService = gameStateService;
        this.objectMapper = objectMapper;
        this.messagingTemplate = messagingTemplate;
    }

    @PostConstruct
    public void connectToBinance(){
        StandardWebSocketClient socketClient = new StandardWebSocketClient();
        try{
            socketClient.execute(this, BINANCE_WS_URL);
            System.out.println("Connceting to Binance WS...");
        }catch (Exception e){
            System.err.println("Failed to connect to Binance WS: " + e.getMessage());
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();

        try {
            JsonNode node = objectMapper.readTree(payload);
            if(node.has("e") && node.get("e").asText().equals("24hrMiniTicker")){
                String symbol = node.get("s").asText().replace("USDT", "");
                double price = node.get("c").asDouble();

                gameStateService.updatePrice(symbol, price);

                messagingTemplate.convertAndSend("/topic/prices", gameStateService.getAllPrices());

            }
        }catch (Exception e){
            System.err.println("Error parsing Binance message: " + e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, org.springframework.web.socket.CloseStatus status) throws Exception {
        System.out.println("Binance WS disconnected. Reconnecting in 5s...");
        Thread.sleep(5000);
        connectToBinance();
    }
}
