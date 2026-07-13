package com.pushkqr.springBackend;

import org.junit.jupiter.api.Test;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.HashMap;
import java.util.List;
import java.util.ArrayList;
import com.pushkqr.springBackend.dto.HistoricalData;

public class SerializationTest {
    @Test
    public void testSerialization() {
        try {
            HistoricalData data = new HistoricalData();
            List<Map<String, Object>> list = new ArrayList<>();
            Map<String, Object> pt = new HashMap<>();
            pt.put("time", 12345L);
            pt.put("price", 60.5);
            list.add(pt);
            data.getHistoricalTickerData().put("BTC", list);

            Map<String, Object> startPayload = new HashMap<>();
            startPayload.put("historicalData", data);

            ObjectMapper mapper = new ObjectMapper();
            System.out.println("JSON_PAYLOAD_OUTPUT: " + mapper.writeValueAsString(startPayload));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
