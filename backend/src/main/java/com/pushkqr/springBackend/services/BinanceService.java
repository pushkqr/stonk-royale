package com.pushkqr.springBackend.services;

import com.pushkqr.springBackend.state.GameStateService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.WebSocketConnectionManager;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import javax.annotation.PostConstruct;

@Service
public class BinanceService extends TextWebSocketHandler {
    private static final Logger logger = LoggerFactory.getLogger(BinanceService.class);
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
        try {
            StandardWebSocketClient client = new StandardWebSocketClient();
            WebSocketConnectionManager manager = new WebSocketConnectionManager(client, this, BINANCE_WS_URL);
            logger.info("Connecting to Binance WS...");
            manager.start();
        } catch (Exception e){
            logger.error("Failed to connect to Binance WS: {}", e.getMessage());
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
            logger.error("Error parsing Binance message: {}", e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        logger.warn("Binance WS disconnected. Reconnecting in 5s...");
        Thread.sleep(5000);
        connectToBinance();
    }
}
