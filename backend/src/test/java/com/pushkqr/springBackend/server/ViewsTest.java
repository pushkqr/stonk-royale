package com.pushkqr.springBackend.server;

import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ViewsTest {

    /**
     * The mid-round tip view may name what the tip claims — a player can already read that
     * straight off the text, so it leaks nothing. It must never gain a truthfulness field:
     * not knowing whether your own tip is real is the entire mechanic.
     *
     * Asserted on the record's shape rather than on a value, because the failure this
     * guards against is somebody adding a field, not somebody setting one wrongly.
     */
    @Test
    void rumorViewCarriesTheClaimButNeverTheTruth() {
        List<String> components = Arrays.stream(Views.Rumor.class.getRecordComponents())
                .map(RecordComponent::getName)
                .toList();

        assertEquals(List.of("text", "claimedRegime"), components);
    }
}
