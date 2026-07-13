package com.pushkqr.springBackend;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

public class BinanceTest {
    @Test
    public void testBinance() {
        try {
            RestClient restClient = RestClient.create("https://api.binance.com/api/v3/klines");
            Object[][] rawKlines = restClient.get()
                    .uri(uriBuilder -> uriBuilder.queryParam("symbol", "BTCUSDT").queryParam("interval", "1m").queryParam("limit", 2).build())
                    .retrieve()
                    .body(Object[][].class);
            System.out.println("BINANCE FETCH SUCCESS!");
            System.out.println("ROWS: " + rawKlines.length);
            for(Object o : rawKlines[0]) {
                System.out.println("TYPE: " + o.getClass().getName() + " VAL: " + o);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
