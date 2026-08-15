package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.admin.Stats;
import com.pushkqr.springBackend.admin.TickMeter;
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

    /**
     * How long a room with nobody connected is kept before it is thrown away. Long enough to
     * survive a locked phone or a wifi handover, short enough that an abandoned room is gone
     * before anyone finds it in the admin panel.
     */
    private static final long ABANDONED_TTL_MILLIS = 120_000;

    private final MatchRegistry matches;
    private final SessionRegistry sessions;
    private final MatchBroadcaster broadcaster;
    private final Stats stats;
    private final TickMeter tickMeter;

    private long ticks;

    public MatchEngine(MatchRegistry matches, SessionRegistry sessions, MatchBroadcaster broadcaster,
            Stats stats, TickMeter tickMeter) {
        this.matches = matches;
        this.sessions = sessions;
        this.broadcaster = broadcaster;
        this.stats = stats;
        this.tickMeter = tickMeter;
    }

    @Scheduled(fixedRate = MatchConfig.STEP_MILLIS)
    public void tick() {
        long startedAt = System.currentTimeMillis();
        long now = startedAt;
        ticks++;

        for (Match match : matches.all()) {
            try {
                advance(match, now);
            } catch (Exception e) {
                // One broken match must not stop the clock for everyone else.
                logger.error("Match {} failed to tick", match.code(), e);
            }
        }

        tickMeter.record(System.currentTimeMillis() - startedAt);
    }

    private void advance(Match match, long now) {
        List<GameEvent> events = match.tick(now);
        events.forEach(event -> publish(match, event));

        if (match.phase() == MatchPhase.TRADING && worthBroadcasting(match.abandonedSinceMillis())) {
            broadcaster.price(match, now);
            if (boardDue(ticks, match.code())) {
                broadcaster.board(match, now);
            }
        }

        if (reapable(match, now)) {
            matches.remove(match.code());
            sessions.removeForMatch(match.code());
            logger.info("Reaped match {} in {}", match.code(), match.phase());
        }
    }

    /**
     * Whether anyone is actually there to receive a frame.
     *
     * A room with no connected human still has to tick — rounds settle, seats expire, the
     * reaper needs its clock — but there is nobody to send the result to. Until this
     * existed, an all-bot room whose player had closed the tab kept emitting twelve frames
     * a second per seat for the full two minutes before it was reaped.
     *
     * @param abandonedSinceMillis Match.abandonedSinceMillis(): zero while a human is
     *                             connected, otherwise when the last one left
     */
    static boolean worthBroadcasting(long abandonedSinceMillis) {
        return abandonedSinceMillis == 0;
    }

    /**
     * Whether this room's board is due on this tick.
     *
     * Offset by the room code, because the counter is the engine's and not the match's:
     * with a bare {@code ticks % 5} every room on the server serialises and flushes its
     * board on the same tick, turning steady traffic into one spike every fifth tick. The
     * spike is what overruns the budget, not the total.
     *
     * floorMod rather than abs: abs(Integer.MIN_VALUE) is still negative, and a negative
     * offset here would misbehave on some room codes and not others.
     */
    static boolean boardDue(long ticks, String code) {
        int offset = Math.floorMod(code.hashCode(), BOARD_EVERY_N_TICKS);
        return Math.floorMod(ticks - offset, (long) BOARD_EVERY_N_TICKS) == 0;
    }

    /**
     * Two ways a room stops being worth keeping: everybody has gone, or the podium has been
     * up long enough that anyone still reading it has finished.
     *
     * Until the first of these existed the registry had exactly one eviction path — the
     * finished timer — so a room that never finished was never removed, and a visitor who
     * took a code and closed the tab left one behind for the life of the process.
     */
    private boolean reapable(Match match, long now) {
        long abandonedSince = match.abandonedSinceMillis();
        if (abandonedSince != 0 && now - abandonedSince > ABANDONED_TTL_MILLIS) {
            return true;
        }
        return match.phase() == MatchPhase.FINISHED
                && now - match.phaseEndsAtMillis() > FINISHED_TTL_MILLIS;
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
                    stats.matchFinished();
                }
            }
            case GameEvent.NewsBroken news ->
                broadcaster.feed(match, "NEWS", news.headline(), null, null);
            case GameEvent.FlowSurge surge ->
                broadcaster.feed(match, "FLOW",
                        surge.roomIsBuying() ? "THE ROOM IS PILING IN" : "THE ROOM IS BAILING OUT",
                        null, null);
            case GameEvent.PlayerLiquidated liquidation -> {
                broadcaster.feed(match, "LIQUIDATION",
                        String.format("%s got LIQUIDATED for $%,.0f", liquidation.nickname(), liquidation.marginLost()),
                        liquidation.playerId(), liquidation.nickname());
                stats.liquidated();
            }
            case GameEvent.RoundSettled settled -> {
                broadcaster.settled(match, settled);
                stats.roundPlayed();
            }
            case GameEvent.BotOpened opened ->
                broadcaster.feed(match, "TRADE",
                        String.format("%s went %dx %s @ %s",
                                opened.nickname(), opened.leverage(), opened.side(),
                                Text.price(opened.entryPrice())),
                        opened.playerId(), opened.nickname());
            case GameEvent.BotClosed closed ->
                broadcaster.feed(match, "TRADE",
                        String.format("%s closed for %s$%,.0f", closed.nickname(),
                                closed.pnl() >= 0 ? "+" : "-", Math.abs(closed.pnl())),
                        closed.playerId(), closed.nickname());
            case GameEvent.BotSaid said ->
                broadcaster.feed(match, "CHAT", said.text(), said.playerId(), said.nickname());
            case GameEvent.SeatVacated vacated -> {
                // The token has to go with the seat, or a stale client could reconnect onto
                // a slot that is no longer theirs.
                sessions.remove(sessions.tokenFor(vacated.playerId()));
                broadcaster.lobby(match);
            }
        }
    }
}
