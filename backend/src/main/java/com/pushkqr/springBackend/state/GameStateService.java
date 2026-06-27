package com.pushkqr.springBackend.state;

import com.pushkqr.springBackend.entities.Room;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GameStateService {
    private final SimpMessagingTemplate messagingTemplate;
    private final String[] tickers = new String[]{"BTC", "ETH", "SOL", "DOGE"};
    private final ConcurrentHashMap<String, Double> cryptoPrices = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Room> activeRooms = new ConcurrentHashMap<>();

    @Autowired
    public GameStateService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
        for(String ticker: tickers)
            cryptoPrices.put(ticker, 0.0);
    }

    public String[] getTickers(){
        return tickers;
    }

    public void updatePrice(String ticker, double newPrice) {
        cryptoPrices.put(ticker, newPrice);
    }
    public double getPrice(String ticker) {
        return cryptoPrices.getOrDefault(ticker, 0.0);
    }

    public void addActiveRoom(String key, Room val) {
        activeRooms.put(key, val);
    }
    public Object getActiveRoom(String key) {
        return activeRooms.getOrDefault(key, null);
    }

    public Map<String, Double> getAllPrices(){
        return cryptoPrices;
    }

}
