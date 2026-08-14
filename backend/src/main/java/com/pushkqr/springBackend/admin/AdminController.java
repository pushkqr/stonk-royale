package com.pushkqr.springBackend.admin;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only, and behind HTTP Basic — see
 * {@link com.pushkqr.springBackend.config.SecurityConfig}.
 *
 * Deliberately has no way to end a match or evict a player: the panel exists to answer
 * "what is happening", and an admin button that could kill a room mid-round is a much
 * worse thing to leave on the internet than a page of numbers.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final Stats stats;

    public AdminController(Stats stats) {
        this.stats = stats;
    }

    @GetMapping("/stats")
    public AdminViews.Snapshot stats() {
        return stats.snapshot();
    }
}
