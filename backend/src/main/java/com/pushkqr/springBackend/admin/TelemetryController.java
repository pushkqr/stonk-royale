package com.pushkqr.springBackend.admin;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Where clients post how the game is running for them.
 *
 * This one has to be open — the players reporting are not logged in as anybody — which
 * makes it the only unauthenticated write in the application. So it stores nothing it was
 * given verbatim: every field is clamped to a sane range and strings are truncated before
 * they reach {@link Stats}, whose ring buffer then bounds how many survive at all.
 */
@RestController
@RequestMapping("/api/telemetry")
public class TelemetryController {

    private static final int MAX_TEXT = 40;

    private final Stats stats;

    public TelemetryController(Stats stats) {
        this.stats = stats;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void report(@RequestBody Request request) {
        stats.report(new Telemetry(
                System.currentTimeMillis(),
                text(request.matchCode()),
                text(request.platform()),
                (int) clamp(request.viewportWidth(), 0, 10_000),
                clamp(request.dpr(), 0, 8),
                clamp(request.medianFrameMs(), 0, 10_000),
                clamp(request.worstFrameMs(), 0, 60_000),
                (int) clamp(request.longFrames(), 0, 100_000),
                (int) clamp(request.points(), 0, 100_000)));
    }

    private static String text(String raw) {
        if (raw == null) {
            return "";
        }
        String trimmed = raw.strip();
        return trimmed.length() <= MAX_TEXT ? trimmed : trimmed.substring(0, MAX_TEXT);
    }

    private static double clamp(Double value, double low, double high) {
        if (value == null || Double.isNaN(value)) {
            return 0;
        }
        return Math.max(low, Math.min(high, value));
    }

    /** Every field optional: a client that cannot measure something sends nothing. */
    public record Request(String matchCode, String platform, Double viewportWidth, Double dpr,
            Double medianFrameMs, Double worstFrameMs, Double longFrames, Double points) {
    }
}
