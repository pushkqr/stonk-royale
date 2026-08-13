package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.GameEvent;
import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.MatchPhase;
import com.pushkqr.springBackend.game.model.MatchConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Drives every live match on one clock.
 *
 * All matches tick together at the price-step rate. Prices go out every tick; the
 * leaderboard is throttled, because a leaderboard that redraws ten times a second is
 * unreadable and mostly wasted bandwidth.
 */
@Service
public class MatchEngine {

    private static final Logger logger = LoggerFactory.getLogger(MatchEngine.class);

    /** Board updates at 2Hz — fast enough to feel live, slow enough to read. */
    private static final int BOARD_EVERY_N_TICKS = 5;

    /** How long a finished match stays around so players can read the final standings. */
    private static final long FINISHED_TTL_MILLIS = 5 * 60_000;

    private final MatchRegistry matches;
    private final SessionRegistry sessions;
    private final MatchBroadcaster broadcaster;

    private long ticks;

    public MatchEngine(MatchRegistry matches, SessionRegistry sessions, MatchBroadcaster broadcaster) {
        this.matches = matches;
        this.sessions = sessions;
        this.broadcaster = broadcaster;
    }

    @Scheduled(fixedRate = MatchConfig.STEP_MILLIS)
    public void tick() {
        long now = System.currentTimeMillis();
        ticks++;

        for (Match match : matches.all()) {
            try {
                advance(match, now);
            } catch (Exception e) {
                // One broken match must not stop the clock for everyone else.
                logger.error("Match {} failed to tick", match.code(), e);
            }
        }
    }

    private void advance(Match match, long now) {
        List<GameEvent> events = match.tick(now);
        events.forEach(event -> publish(match, event));

        if (match.phase() == MatchPhase.TRADING) {
            broadcaster.price(match, now);
            if (ticks % BOARD_EVERY_N_TICKS == 0) {
                broadcaster.board(match, now);
            }
        } else if (match.phase() == MatchPhase.FINISHED
                && now - match.phaseEndsAtMillis() > FINISHED_TTL_MILLIS) {
            matches.remove(match.code());
            sessions.removeForMatch(match.code());
            logger.info("Reaped finished match {}", match.code());
        }
    }

    private void publish(Match match, GameEvent event) {
        switch (event) {
            case GameEvent.PhaseChanged phase -> {
                broadcaster.phase(match);
                if (phase.phase() == MatchPhase.INTERMISSION) {
                    broadcaster.rumors(match);
                    broadcaster.standings(match);
                } else if (phase.phase() == MatchPhase.FINISHED) {
                    broadcaster.standings(match);
                }
            }
            case GameEvent.NewsBroken news ->
                broadcaster.feed(match, "NEWS", news.headline(), null, null);
            case GameEvent.PlayerLiquidated liquidation ->
                broadcaster.feed(match, "LIQUIDATION",
                        String.format("%s got LIQUIDATED for $%,.0f", liquidation.nickname(), liquidation.marginLost()),
                        liquidation.playerId(), liquidation.nickname());
            case GameEvent.RoundSettled settled -> broadcaster.settled(match, settled);
        }
    }
}
