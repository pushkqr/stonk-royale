package com.pushkqr.springBackend.services;

import com.pushkqr.springBackend.dto.BinanceKline;
import com.pushkqr.springBackend.dto.HistoricalData;
import com.pushkqr.springBackend.state.GameStateService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class MarketService {

    private static final Logger logger = LoggerFactory.getLogger(MarketService.class);

    private final RestClient restClient;

    private GameStateService gameStateService;

    @Autowired
    public MarketService(@Value("${binance.baseurl}") String baseUrl, GameStateService gameStateService){
        this.restClient = RestClient.create(baseUrl);
        this.gameStateService = gameStateService;
    }

    public java.util.Map<String, java.util.List<java.util.Map<String, Object>>> getHistoricalCharts(){
        java.util.Map<String, java.util.List<java.util.Map<String, Object>>> data = new java.util.HashMap<>();

        try{
            for(String ticker: gameStateService.getTickers()){
                Object[][] rawKlines = restClient.get()
                        .uri(uriBuilder -> uriBuilder.queryParam("symbol", ticker + "USDT").queryParam("interval", "1m").queryParam("limit", 60).build())
                        .retrieve()
                        .body(Object[][].class);
                
                java.util.List<java.util.Map<String, Object>> chartData = new java.util.ArrayList<>();
                if (rawKlines != null) {
                    for (Object[] row : rawKlines) {
                        java.util.Map<String, Object> point = new java.util.HashMap<>();
                        point.put("time", ((Number) row[0]).longValue());
                        point.put("price", Double.parseDouble(row[4].toString())); // close price
                        chartData.add(point);
                    }
                }
                data.put(ticker, chartData);
            }
            return data;
        }catch (Exception e){
            logger.error("Error fetching historical charts: {}", e.getMessage(), e);
            for(String ticker: gameStateService.getTickers()){
                if(!data.containsKey(ticker)){
                    data.put(ticker, new java.util.ArrayList<>());
                }
            }
            return data;
        }
    }
}
