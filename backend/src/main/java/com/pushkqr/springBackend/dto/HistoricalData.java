package com.pushkqr.springBackend.dto;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class HistoricalData {
    private Map<String, List<Map<String, Object>>> historicalTickerData;

    public HistoricalData() {
        historicalTickerData = new HashMap<>();
    }

    public Map<String, List<Map<String, Object>>> getHistoricalTickerData() {
        return historicalTickerData;
    }

    public void setHistoricalTickerData(Map<String, List<Map<String, Object>>> historicalTickerData) {
        this.historicalTickerData = historicalTickerData;
    }

}
