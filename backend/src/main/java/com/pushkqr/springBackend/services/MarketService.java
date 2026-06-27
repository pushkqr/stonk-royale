package com.pushkqr.springBackend.services;

import com.pushkqr.springBackend.dto.BinanceKline;
import com.pushkqr.springBackend.dto.HistoricalData;
import com.pushkqr.springBackend.state.GameStateService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class MarketService {

    private final RestClient restClient;

    private GameStateService gameStateService;

    @Autowired
    public MarketService(@Value("${binance.baseurl}") String baseUrl, GameStateService gameStateService){
        this.restClient = RestClient.create(baseUrl);
        this.gameStateService = gameStateService;
    }

    public HistoricalData getHistoricalCharts(){
        HistoricalData data = new HistoricalData();

        try{
            for(String ticker: gameStateService.getTickers()){
                BinanceKline[] klines = restClient.get().uri(uriBuilder -> uriBuilder.queryParam("symbol", ticker + "USDT").queryParam("interval", "1m").queryParam("limit", 60).build()).retrieve().body(BinanceKline[].class);
                data.historicalTickerData.put(ticker, klines);
            }
            return data;
        }catch (Exception e){
            System.out.println("Error fetching historical charts: " + e.getMessage());
            for(String ticker: gameStateService.getTickers()){
                if(!data.historicalTickerData.containsKey(ticker)){
                    data.historicalTickerData.put(ticker, new BinanceKline[]{});
                }
            }
            return data;
        }
    }
}
