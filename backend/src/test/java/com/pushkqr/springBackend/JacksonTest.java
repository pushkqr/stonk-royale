package com.pushkqr.springBackend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.pushkqr.springBackend.entities.RoomPlayer;
import org.junit.jupiter.api.Test;

public class JacksonTest {
    @Test
    public void testSerialization() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        
        RoomPlayer rp = new RoomPlayer();
        rp.setIsReady(true);
        
        System.out.println("JACKSON OUTPUT: " + mapper.writeValueAsString(rp));
    }
}
