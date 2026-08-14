package com.pushkqr.springBackend.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/**
 * Reads and writes the cumulative counters as a single JSON file.
 *
 * A file rather than a database because the project deliberately has neither, and a party
 * game's lifetime totals do not justify one. The trade is honest: this survives a restart
 * and a redeploy, and does not survive the droplet being rebuilt without its volume.
 *
 * Writes go to a temporary file and are then moved into place, so a crash mid-write leaves
 * the previous totals intact rather than a half-written file that fails to parse on the
 * next boot.
 */
@Component
public class StatsStore {

    private static final Logger logger = LoggerFactory.getLogger(StatsStore.class);

    private final ObjectMapper json = new ObjectMapper();
    private final Path file;

    public StatsStore(@Value("${stonk.stats-file:data/stats.json}") String path) {
        this.file = Path.of(path);
    }

    public Totals load() {
        if (!Files.exists(file)) {
            return new Totals();
        }
        try {
            return json.readValue(Files.readAllBytes(file), Totals.class);
        } catch (IOException e) {
            // Starting from zero beats refusing to boot over a stats file.
            logger.warn("Could not read {}, starting counters from zero: {}", file, e.getMessage());
            return new Totals();
        }
    }

    public void save(Totals totals) {
        try {
            Path parent = file.toAbsolutePath().getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Path temp = Files.createTempFile(parent, "stats", ".tmp");
            Files.write(temp, json.writeValueAsBytes(totals));
            Files.move(temp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            // The game does not stop for a stats file it cannot write.
            logger.warn("Could not write {}: {}", file, e.getMessage());
        }
    }
}
