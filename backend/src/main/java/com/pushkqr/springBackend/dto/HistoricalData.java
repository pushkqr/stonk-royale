package com.pushkqr.springBackend.dto;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class HistoricalData {
    public Map<String, BinanceKline[]> historicalTickerData;

    public HistoricalData() {
        historicalTickerData = new HashMap<>();
    }

}
