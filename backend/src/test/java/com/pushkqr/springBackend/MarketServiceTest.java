package com.pushkqr.springBackend;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.HashMap;
import com.fasterxml.jackson.databind.ObjectMapper;

public class MarketServiceTest {
    @Test
    public void testMarketService() {
        try {
            RestClient restClient = RestClient.create("https://api.binance.com/api/v3/klines");
            List<String> tickers = List.of("BTC", "ETH", "SOL", "DOGE");
            
            Map<String, List<Map<String, Object>>> historicalTickerData = new HashMap<>();

            for(String ticker: tickers){
                Object[][] rawKlines = restClient.get()
                        .uri(uriBuilder -> uriBuilder.queryParam("symbol", ticker + "USDT").queryParam("interval", "1m").queryParam("limit", 2).build())
                        .retrieve()
                        .body(Object[][].class);
                
                List<Map<String, Object>> chartData = new ArrayList<>();
                if (rawKlines != null) {
                    for (Object[] row : rawKlines) {
                        Map<String, Object> point = new HashMap<>();
                        point.put("time", ((Number) row[0]).longValue());
                        point.put("price", Double.parseDouble(row[4].toString())); // close price
                        chartData.add(point);
                    }
                }
                historicalTickerData.put(ticker, chartData);
                System.out.println("TICKER SUCCESS: " + ticker + " ROWS: " + chartData.size());
            }

            ObjectMapper mapper = new ObjectMapper();
            System.out.println("JSON OUTPUT: " + mapper.writeValueAsString(historicalTickerData));

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
