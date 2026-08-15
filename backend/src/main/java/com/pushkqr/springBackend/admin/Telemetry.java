package com.pushkqr.springBackend.admin;

/**
 * One client's report on how the game is actually running for them.
 *
 * Everything here is measured in the browser, because that is the only place it exists —
 * the server has no idea whether a chart is stuttering. This is what turns "it lagged for
 * a bit" into a number.
 *
 * @param medianFrameMs typical frame time — but read it against refreshMs, not against 16.7:
 *                      a 120Hz display cannot report more than 8.3 however well it is running
 * @param refreshMs     the display's own frame interval, timed by a short probe of raw
 *                      animation frames. Not inferred from the frames behind medianFrameMs:
 *                      the chart's loop is capped, so its shortest frame is the cap
 * @param worstFrameMs  the longest single frame in the window, which is where a stall shows
 * @param longFrames    frames over 50ms, the ones a player actually perceives as a hitch
 * @param dpr           device pixel ratio, since fill cost scales with its square
 */
public record Telemetry(
        long atEpochMillis,
        String matchCode,
        String platform,
        int viewportWidth,
        double dpr,
        double medianFrameMs,
        double refreshMs,
        double worstFrameMs,
        int longFrames,
        int points) {
}
