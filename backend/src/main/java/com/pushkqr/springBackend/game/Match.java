package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.bot.BotAction;
import com.pushkqr.springBackend.game.bot.BotChatter;
import com.pushkqr.springBackend.game.info.MarketEvent;
import com.pushkqr.springBackend.game.info.Rumor;
import com.pushkqr.springBackend.game.model.MatchConfig;
import com.pushkqr.springBackend.game.model.PlayerRound;
import com.pushkqr.springBackend.game.model.Position;
import com.pushkqr.springBackend.game.model.Side;
import com.pushkqr.springBackend.game.sim.MarketImpact;
import com.pushkqr.springBackend.game.sim.Regime;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * One live match, held entirely in memory.
 *
 * Deliberately free of Spring and persistence: {@link #tick(long)} takes the current time
 * and returns what happened, so the whole game loop can be tested by calling it with made-up
 * timestamps instead of waiting out real 90-second rounds.
 */
public final class Match {

    /**
     * One, not two. A player alone in their own room is harmless, and practice mode needs
     * it. The lobby UI still withholds Start until a second player arrives, which is where
     * "don't start before your friends turn up" actually belongs.
     */
    public static final int MIN_PLAYERS = 1;

    /**
     * How long the briefing waits for a full house before starting anyway. Long enough that
     * a room reading at its own pace never sees it, short enough that one locked phone does
     * not end the evening.
     */
    public static final long BRIEFING_FAILSAFE_MILLIS = 90_000;

    /**
     * How long a seat is held for a socket that has gone quiet.
     *
     * Long enough to cover a page reload, a tunnel, or a wifi handover — all of which are
     * indistinguishable from a closed tab at the moment they happen. Short enough that a
     * genuinely abandoned seat is gone before the room fills up around it.
     */
    public static final long SEAT_GRACE_MILLIS = 45_000;

    /** Half of MarketImpact's cap — a push worth telling the room about, not just noise. */
    private static final double FLOW_SURGE_THRESHOLD = 0.03;

    /** Keeps a value oscillating right at the threshold from spamming the wire. */
    private static final long FLOW_SURGE_COOLDOWN_MILLIS = 5_000;

    private final String code;
    /** Not final: the host can retune the room from the lobby, before anything is planned. */
    private MatchConfig config;
    private final Map<String, MatchPlayer> players = new LinkedHashMap<>();
    private final RoundPlanner planner = new RoundPlanner();
    private final BotChatter chatter = new BotChatter();

    /**
     * One player's largest possible position — what one trade's impact is measured against.
     * Not final: it is derived from starting cash, which the host can change in the lobby.
     */
    private double referenceNotional;

    private MatchPhase phase = MatchPhase.LOBBY;

    /**
     * Whether this room can be found by somebody who does not have its code.
     *
     * False unless asked otherwise. A five-character code out of thirty-two symbols is
     * already thirty-three million combinations, so a private room is private by not being
     * listed anywhere — there is nothing else to enforce.
     */
    private boolean isPublic;

    private int roundIndex = -1;
    private long phaseEndsAtMillis;
    private long roundStartedAtMillis;
    private RoundPlan round;
    private int newsFired;
    private int chatterFired;
    private int botActionsFired;
    private MarketImpact impact;
    private boolean flowSurging;
    private long lastFlowEventMillis = Long.MIN_VALUE;

    /** When the last human socket went away, or 0 while somebody is still here. */
    private long abandonedSinceMillis;

    /**
     * What each player has told the room their tip says, this round only.
     *
     * Held here rather than on the player because it is evidence about a round, not money:
     * it exists to be compared against the tip they were actually dealt, which is the only
     * lie the server can prove.
     */
    private final Map<String, Regime> tipClaims = new LinkedHashMap<>();

    /** Who has read the briefing. Covering the roster is what opens the first round. */
    private final Set<String> readyIds = new HashSet<>();

    /** Bumped by a rematch that wants a fresh market; held to replay the same one. */
    private int generation;

    public Match(String code, MatchConfig config) {
        this.code = code;
        this.config = config;
        this.referenceNotional = config.startingCash() * Position.MAX_LEVERAGE;
    }

    /*
     * Package-private on purpose. These hand out live, unsynchronized MatchPlayer objects,
     * which is safe inside this package where every caller is already holding the monitor,
     * and was the whole bug outside it. Callers elsewhere get PlayerSnapshot instead.
     */

    /**
     * Seats a player.
     *
     * Any phase, not just the lobby. Somebody who arrives five minutes into the evening used
     * to bounce off "Match has already started" and wait out the whole match for a rematch,
     * which for a game people wander into is the friction that costs the most. The round in
     * progress was planned for the roster that existed when it was planned, so a latecomer
     * sits it out and starts scoring from the next one — see {@link #beginTrading}.
     */
    synchronized MatchPlayer join(String playerId, String nickname) {
        return join(playerId, nickname, null);
    }

    synchronized MatchPlayer join(String playerId, String nickname, String avatar) {
        MatchPlayer existing = players.get(playerId);
        if (existing != null && !existing.hasLeft()) {
            existing.setAvatar(avatar);
            return existing;
        }
        if (activePlayerIds().size() >= config.maxPlayers()) {
            throw new IllegalStateException("Match is full");
        }

        // Standings and accusations rely on names being distinguishable. Two "Alice" rows
        // make the standings unreadable and every accusation ambiguous, so the room rejects
        // a name that is already occupied. Case-insensitive because "alice" reads the same
        // on screen. Players who have left do not count — their seat is retired.
        boolean taken = players.values().stream()
                .filter(p -> !p.hasLeft())
                .anyMatch(p -> p.nickname().equalsIgnoreCase(nickname));
        if (taken) {
            throw new IllegalStateException("Someone in this room is already called " + nickname);
        }

        // A retired seat is spent — see leave() — and its record is what the standings still
        // read that player's score out of. Somebody who quit mid-match and came back is
        // therefore seated as a newcomer under an id of their own, rather than reoccupying
        // the seat they gave up and erasing the score that went with it. Scanned for a free
        // slot rather than counted, the same way Bots.seat picks a bot id.
        String seatId = playerId;
        for (int i = 1; players.containsKey(seatId); i++) {
            seatId = playerId + ":r" + i;
        }

        boolean hasActiveHost = players.values().stream()
                .anyMatch(p -> p.isHost() && !p.hasLeft());
        MatchPlayer player = new MatchPlayer(seatId, nickname, !hasActiveHost);
        player.setAvatar(avatar);
        players.put(seatId, player);
        return player;
    }

    /** Seats a player and returns only what a caller outside this package may hold. */
    public synchronized PlayerSnapshot seat(String playerId, String nickname, String avatar) {
        join(playerId, nickname, avatar);
        return playerSnapshots(System.currentTimeMillis()).stream()
                .filter(snapshot -> snapshot.id().equals(playerId))
                .findFirst()
                .orElseThrow();
    }

    /**
     * Seats a scripted opponent.
     *
     * Practice only. A player alone in a room has no market to read, nobody to lie to and
     * nothing to beat — the social half of the game is simply absent. Bots restore it
     * without needing four friends in the room.
     *
     * Never host, whatever the seating order: the host badge carries the right to start the
     * match and retune the room, and nothing can press those buttons on a bot's behalf.
     */
    synchronized MatchPlayer addBot(String id, String nickname) {
        if (phase != MatchPhase.LOBBY) {
            throw new IllegalStateException("Match has already started");
        }
        MatchPlayer bot = new MatchPlayer(id, nickname, false, true);
        bot.setAvatar(Avatars.forSeed(id));
        players.put(id, bot);
        return bot;
    }

    /**
     * Seats one bot, atomically.
     *
     * The name and id searches and the insert all happen under one lock. They used to be
     * three separate calls from Bots.seat with the lock released between each, so two
     * threads scanning at once could both settle on the same free name — and quick match
     * fills a room with bots on the same request other people are joining it.
     *
     * @param candidateNames tried in order; the first not already in the room wins
     */
    public synchronized MatchPlayer seatBot(List<String> candidateNames) {
        if (players.size() >= config.maxPlayers()) {
            throw new IllegalStateException("Match is full");
        }

        // The name check is against everybody present, humans and bots alike: the host can add
        // these one at a time on top of whatever quick match already seated, so "the next name
        // in the list" is not good enough on its own.
        Set<String> takenNames = players.values().stream()
                .map(player -> player.nickname().toLowerCase())
                .collect(Collectors.toSet());

        String name = candidateNames.stream()
                .filter(n -> !takenNames.contains(n.toLowerCase()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No more bot names available"));

        // Ids are scanned for the first free slot rather than counted, because a host can add a
        // bot, kick it, and add another — a counter would hand out an id that is already taken.
        Set<String> takenIds = players.keySet();

        String id = null;
        for (int i = 0; i < 1000; i++) {
            String candidate = "bot:" + i;
            if (!takenIds.contains(candidate)) {
                id = candidate;
                break;
            }
        }
        return addBot(id, name);
    }

    /**
     * The picker lives in the lobby, so a player can change their mark after being seated.
     * Here rather than on MatchPlayer because the field is a plain String with no memory
     * visibility of its own: written from a STOMP thread and read by the engine, it needs
     * this monitor on both sides or the room can keep rendering the old mark indefinitely.
     *
     * @return whether a seat was actually found, so a caller can skip a pointless broadcast
     */
    public synchronized boolean setAvatar(String playerId, String avatar) {
        MatchPlayer player = players.get(playerId);
        if (player == null) {
            return false;
        }
        player.setAvatar(avatar);
        return true;
    }

    /**
     * Frees a seat. Only a deliberate departure reaches here — a dropped socket does not,
     * because phones lock their screens constantly and the client reconnects and resyncs.
     * Ejecting on disconnect would throw people out of rounds they are still playing.
     *
     * Between matches the seat goes, so a leaver stops holding a slot, stops being dealt a
     * rumour, and stops appearing in the next lobby. Mid-match the seat is retired rather
     * than removed: deleting it would leave the standings referencing rounds played by
     * somebody who is no longer in them, while keeping it live would deal a fresh tip and
     * stack every round to a player who has gone. Retiring puts them on exactly the path a
     * latecomer takes — no tip planned, so no stack, and settlement skips them without
     * recording a false zero.
     *
     * @return whether the roster changed and the room needs telling
     */
    public synchronized boolean leave(String playerId, long now) {
        if (phase != MatchPhase.LOBBY && phase != MatchPhase.FINISHED) {
            MatchPlayer quitting = players.get(playerId);
            if (quitting == null || quitting.hasLeft()) {
                return false;
            }
            quitting.retire();
            quitting.setConnected(false, now);
            if (quitting.isHost()) {
                nextHost().ifPresent(MatchPlayer::promoteToHost);
            }
            return true;
        }

        MatchPlayer gone = players.remove(playerId);
        if (gone == null) {
            return false;
        }

        if (gone.isHost()) {
            nextHost().ifPresent(MatchPlayer::promoteToHost);
        }
        return true;
    }

    /**
     * Who should get the room when the host gives up their seat.
     *
     * Never a bot. Insertion order alone would usually pick one — quick match seats the
     * human first and backfills the rest — and a bot never presses start, so the room keeps
     * its slot and becomes unplayable for anyone who wanders in.
     *
     * A connected human first, because promoting somebody whose socket has already dropped
     * only moves the problem. Then any human, since they may be inside their grace period
     * and on their way back. If only bots are left there is nobody to promote and the room
     * correctly ends up hostless — trackAbandonment has already started its clock on it.
     *
     * Insertion order within each pass, so the badge still lands on whoever has been here
     * longest.
     */
    private Optional<MatchPlayer> nextHost() {
        return players.values().stream()
                .filter(player -> !player.isBot() && !player.hasLeft() && player.isConnected())
                .findFirst()
                .or(() -> players.values().stream()
                        .filter(player -> !player.isBot() && !player.hasLeft())
                        .findFirst());
    }

    /**
     * Gives up seats whose sockets have been gone longer than the grace period.
     *
     * Lobby and results only. Mid-match a seat is kept however long its owner is away; see
     * {@link #leave}. Bots are skipped — they never have a socket to lose, and clearing them
     * would empty a practice room the moment it started.
     */
    private void vacateExpiredSeats(long now, List<GameEvent> events) {
        List<String> expired = new ArrayList<>();

        for (MatchPlayer player : players.values()) {
            if (player.isBot() || player.isConnected()) {
                continue;
            }
            if (player.disconnectedSinceMillis() == 0) {
                // A seat handed out over HTTP whose socket never opened. Nothing ever
                // disconnected, so nothing started its clock — and a seat with no clock is
                // held for the life of the process, which is exactly the ghost this grace
                // period exists to clear. Start it the first time the loop notices.
                player.setConnected(false, now);
                continue;
            }
            if (now - player.disconnectedSinceMillis() > SEAT_GRACE_MILLIS) {
                expired.add(player.id());
            }
        }

        // Collected before removing any: leave() mutates the map the loop above walks.
        for (String playerId : expired) {
            MatchPlayer player = players.get(playerId);
            // Reuses leave() so the host badge moves the same way a deliberate departure
            // moves it, rather than stranding a room with no host.
            if (player != null && leave(playerId, now)) {
                events.add(new GameEvent.SeatVacated(playerId, player.nickname()));
            }
        }
    }

    /**
     * Whether anybody is still here who could be watching.
     *
     * Not "are there zero seats" — a practice room keeps its bots after its one human
     * closes the tab, and a room that can never be reaped is a match that ticks forever
     * and a registry entry that lives until the process dies.
     */
    public synchronized boolean hasNoHumans() {
        return players.values().stream().allMatch(player -> player.isBot() || player.hasLeft());
    }

    /**
     * Starts the match into the briefing. The first round is planned here so the
     * intermission has an asset and a rumor ready the moment the gate opens.
     */
    public synchronized List<GameEvent> start(long now) {
        if (phase != MatchPhase.LOBBY) {
            throw new IllegalStateException("Match has already started");
        }
        if (players.size() < MIN_PLAYERS) {
            throw new IllegalStateException("Need at least " + MIN_PLAYERS + " players");
        }
        List<GameEvent> events = new ArrayList<>();
        planRound(0);
        enterBriefing(now, events);
        return events;
    }

    /**
     * Retunes the room before it opens.
     *
     * Lobby only. After the start whistle the config drives round planning and scoring, and
     * swapping it under a running match would leave the two disagreeing about how long a
     * round is and how many are left.
     */
    public synchronized void updateConfig(MatchConfig next) {
        if (phase != MatchPhase.LOBBY) {
            throw new IllegalStateException("Settings are locked once the match has started");
        }
        if (next.maxPlayers() < players.size()) {
            throw new IllegalArgumentException(
                    "There are already " + players.size() + " players in the room");
        }
        config = next;
        referenceNotional = config.startingCash() * Position.MAX_LEVERAGE;
    }

    /**
     * Reopens the finished room for another match, keeping every seat and setting.
     *
     * Returning to LOBBY rather than straight into a round is deliberate: it is the only
     * window in which someone new can join, so it doubles as the way a latecomer gets in.
     *
     * @param sameMarket replay the identical market, making the rematch a fair rerun
     */
    public synchronized List<GameEvent> rematch(boolean sameMarket, long now) {
        if (phase != MatchPhase.FINISHED) {
            throw new IllegalStateException("The match is still running");
        }
        if (!sameMarket) {
            generation++;
        }

        players.values().forEach(MatchPlayer::resetForRematch);
        tipClaims.clear();
        readyIds.clear();
        phase = MatchPhase.LOBBY;
        roundIndex = -1;
        round = null;
        newsFired = 0;
        phaseEndsAtMillis = now;

        return List.of(new GameEvent.PhaseChanged(MatchPhase.LOBBY, roundIndex, now));
    }

    // --- the loop ------------------------------------------------------------

    public synchronized List<GameEvent> tick(long now) {
        trackAbandonment(now);
        List<GameEvent> events = new ArrayList<>();
        switch (phase) {
            case LOBBY, FINISHED -> vacateExpiredSeats(now, events);
            case BRIEFING -> {
                if (everyPresentPlayerIsReady() || now >= phaseEndsAtMillis) {
                    enterIntermission(now, events);
                }
            }
            case INTERMISSION -> {
                fireDueChatter(now - (phaseEndsAtMillis - config.intermissionMillis()), events);
                if (now >= phaseEndsAtMillis) {
                    beginTrading(now, events);
                }
            }
            case TRADING -> {
                long elapsed = now - roundStartedAtMillis;
                fireDueNews(elapsed, events);
                fireDueBotActions(elapsed, now, events);
                // Read after the bots have traded, not before: their opens and closes move
                // MarketImpact, and a liquidation checked against a pre-bot price would miss
                // exactly the push that caused it.
                double price = currentPrice(now);
                checkLiquidations(price, now, events);
                checkFlowSurge(now, events);
                if (now >= phaseEndsAtMillis) {
                    settleRound(price, now, events);
                }
            }
        }
        addBotReactions(events, now);
        return events;
    }

    private void fireDueNews(long elapsed, List<GameEvent> events) {
        List<MarketEvent> scheduled = round.events();
        while (newsFired < scheduled.size() && scheduled.get(newsFired).atMillis() <= elapsed) {
            events.add(new GameEvent.NewsBroken(scheduled.get(newsFired).headline()));
            newsFired++;
        }
    }

    private void fireDueChatter(long elapsed, List<GameEvent> events) {
        List<BotAction.Say> scheduled = round.botScript().chatter();
        while (chatterFired < scheduled.size() && scheduled.get(chatterFired).atMillis() <= elapsed) {
            say(scheduled.get(chatterFired), events);
            chatterFired++;
        }
    }

    private void fireDueBotActions(long elapsed, long now, List<GameEvent> events) {
        List<BotAction> scheduled = round.botScript().actions();
        while (botActionsFired < scheduled.size() && scheduled.get(botActionsFired).atMillis() <= elapsed) {
            perform(scheduled.get(botActionsFired), now, events);
            botActionsFired++;
        }
    }

    /**
     * Runs one scheduled bot action, or quietly drops it.
     *
     * A script is authored before the round and cannot know what the market did to the bot
     * meanwhile: a liquidation can wipe the cash an entry needed, or close a position the
     * script still expects to exit. Every action is checked against the state it actually
     * finds. Throwing instead would escape tick() and abandon the rest of the round for
     * everyone — liquidation checks and settlement included.
     */
    private void perform(BotAction action, long now, List<GameEvent> events) {
        MatchPlayer bot = players.get(action.botId());
        if (bot == null || bot.round() == null) {
            return;
        }
        PlayerRound playerRound = bot.round();

        switch (action) {
            case BotAction.Open open -> {
                if (playerRound.hasPosition() || playerRound.cash() <= 0) {
                    return;
                }
                // Clamped here rather than in BotScripter, whose script is seeded and has
                // to stay reproducible. Under a leverage floor an unclamped bot scripted at
                // 2x throws, MatchEngine's per-match catch swallows it, and that bot simply
                // stops trading for the round with nothing on screen to say why.
                int botLeverage = Math.max(open.leverage(), config.modifier().minLeverage());
                Position position = openPosition(
                        bot.id(), open.side(), open.sizeFraction(), botLeverage, now);
                events.add(new GameEvent.BotOpened(bot.id(), bot.nickname(),
                        position.side(), position.leverage(), position.entryPrice()));
            }
            case BotAction.Close close -> {
                if (!playerRound.hasPosition()) {
                    return;
                }
                double pnl = closePosition(bot.id(), now);
                events.add(new GameEvent.BotClosed(bot.id(), bot.nickname(), pnl));
            }
            case BotAction.Say say -> say(say, events);
        }
    }

    private void say(BotAction.Say say, List<GameEvent> events) {
        MatchPlayer bot = players.get(say.botId());
        if (bot == null) {
            return;
        }
        // Goes through the same ledger a person's claim does, so a bot's lie is caught and
        // shown at settle exactly like a player's.
        recordTipClaim(bot.id(), say.claim());
        events.add(new GameEvent.BotSaid(bot.id(), bot.nickname(), say.text()));
    }

    /**
     * Lets the bots answer what just happened.
     *
     * Iterates a copy taken before anything is appended, so a bot's reaction can never
     * become the trigger for another one — three bots answering each other inside a single
     * tick would not terminate.
     */
    private void addBotReactions(List<GameEvent> events, long now) {
        List<String> bots = botIds();
        if (bots.isEmpty()) {
            return;
        }
        List<GameEvent> triggers = List.copyOf(events);
        for (GameEvent trigger : triggers) {
            String subject = trigger instanceof GameEvent.PlayerLiquidated liquidation
                    ? liquidation.playerId()
                    : null;
            BotChatter.Reaction reaction = chatter.reactTo(trigger, bots, subject, now);
            if (reaction != null) {
                MatchPlayer bot = players.get(reaction.botId());
                events.add(new GameEvent.BotSaid(bot.id(), bot.nickname(), reaction.text()));
            }
        }
    }

    private void checkLiquidations(double price, long now, List<GameEvent> events) {
        for (MatchPlayer player : players.values()) {
            PlayerRound playerRound = player.round();
            if (playerRound == null || !playerRound.hasPosition()) {
                continue;
            }
            Position position = playerRound.position();
            double margin = position.margin();
            if (playerRound.liquidateIfBreached(price)) {
                // A forced close is a sell like any other — it pushes the price further
                // in its own direction, which is what lets a cascade emerge on its own.
                impact.record(position.notional(), -position.side().direction(), referenceNotional, now);
                events.add(new GameEvent.PlayerLiquidated(
                        player.id(), player.nickname(), margin * Position.MAINTENANCE));
            }
        }
    }

    private void checkFlowSurge(long now, List<GameEvent> events) {
        double value = impact.valueAt(now);
        boolean above = Math.abs(value) >= FLOW_SURGE_THRESHOLD;
        if (above && !flowSurging && now >= lastFlowEventMillis + FLOW_SURGE_COOLDOWN_MILLIS) {
            events.add(new GameEvent.FlowSurge(value > 0));
            lastFlowEventMillis = now;
        }
        flowSurging = above;
    }

    private void settleRound(double finalPrice, long now, List<GameEvent> events) {
        List<RoundResult> results = new ArrayList<>();

        for (MatchPlayer player : players.values()) {
            PlayerRound playerRound = player.round();
            // Somebody who joined after this round was planned is not in it. No stack, no
            // tip, no result — and deliberately no recorded score, because a zero would read
            // as having played the round and broken even.
            if (playerRound == null) {
                continue;
            }
            if (playerRound.hasPosition()) {
                playerRound.close(finalPrice);
            }
            double score = playerRound.scoreAt(finalPrice);
            int liquidations = playerRound.liquidations();
            Rumor rumor = round.rumorFor(player.id());

            player.recordRoundScore(score);
            results.add(new RoundResult(
                    player.id(), player.nickname(), score, player.totalScore(),
                    liquidations, rumor.claimedRegime(), rumor.truthful(),
                    tipClaims.get(player.id())));
        }

        results.sort(Comparator.comparingDouble(RoundResult::totalScore).reversed());
        events.add(new GameEvent.RoundSettled(roundIndex, round.regime(), List.copyOf(results)));

        if (roundIndex + 1 < config.rounds()) {
            planRound(roundIndex + 1);
            enterIntermission(now, events);
        } else {
            phase = MatchPhase.FINISHED;
            phaseEndsAtMillis = now;
            events.add(new GameEvent.PhaseChanged(MatchPhase.FINISHED, roundIndex, now));
        }
    }

    private void planRound(int index) {
        roundIndex = index;
        round = planner.plan(matchSeed(), index, activePlayerIds(), botIds(), config);
    }

    /** Who the next round is for. A retired seat is skipped exactly as a latecomer's is. */
    public synchronized Set<String> activePlayerIds() {
        return players.values().stream()
                .filter(player -> !player.hasLeft())
                .map(MatchPlayer::id)
                .collect(Collectors.toUnmodifiableSet());
    }

    /** Sorted downstream by the planner; this is just the subset of seats that are scripted. */
    private List<String> botIds() {
        return players.values().stream()
                .filter(MatchPlayer::isBot)
                .map(MatchPlayer::id)
                .toList();
    }

    /** Same code and generation means the same market, which is what a replay rematch wants. */
    private long matchSeed() {
        return (code + ":" + generation).hashCode();
    }

    private void enterBriefing(long now, List<GameEvent> events) {
        readyIds.clear();
        phase = MatchPhase.BRIEFING;
        phaseEndsAtMillis = now + BRIEFING_FAILSAFE_MILLIS;
        events.add(new GameEvent.PhaseChanged(MatchPhase.BRIEFING, roundIndex, phaseEndsAtMillis));
    }

    private void enterIntermission(long now, List<GameEvent> events) {
        readyIds.clear();
        // Cleared here rather than at the open, because this is where the new tip is dealt
        // and players can start going on record about it straight away.
        tipClaims.clear();
        chatterFired = 0;
        phase = MatchPhase.INTERMISSION;
        phaseEndsAtMillis = now + config.intermissionMillis();
        events.add(new GameEvent.PhaseChanged(MatchPhase.INTERMISSION, roundIndex, phaseEndsAtMillis));
    }

    private void beginTrading(long now, List<GameEvent> events) {
        // Only the roster the round was planned for. A latecomer has no tip — tips are dealt
        // in planRound — and giving them a stack without one would put somebody in a round
        // holding none of the information it is played with.
        players.values().stream()
                .filter(player -> !player.hasLeft() && round.rumorFor(player.id()) != null)
                .forEach(player -> player.beginRound(config.startingCash()));
        phase = MatchPhase.TRADING;
        roundStartedAtMillis = now;
        phaseEndsAtMillis = now + config.roundMillis();
        newsFired = 0;
        botActionsFired = 0;
        impact = new MarketImpact(now, config.marketImpactMultiplier());
        flowSurging = false;
        lastFlowEventMillis = Long.MIN_VALUE;
        events.add(new GameEvent.PhaseChanged(MatchPhase.TRADING, roundIndex, phaseEndsAtMillis));
    }

    // --- player actions ------------------------------------------------------

    /**
     * Records that a player has read the briefing.
     *
     * An unknown id is ignored rather than rejected: the gate opens on covering the roster,
     * so a stale id could never open it early anyway.
     *
     * @return whether this changed anything and the room needs telling
     */
    public synchronized boolean markReady(String playerId) {
        if (phase != MatchPhase.BRIEFING || !players.containsKey(playerId)) {
            return false;
        }
        return readyIds.add(playerId);
    }

    /**
     * Records whether a player's socket is up.
     *
     * A dropped socket is not a departure — phones lock their screens constantly and the
     * client reconnects — so this never frees the seat. It exists so a player who has
     * vanished cannot hold the briefing gate shut for everybody else.
     *
     * @return whether the roster changed and the room needs telling
     */
    public synchronized boolean markConnected(String playerId, boolean connected, long now) {
        MatchPlayer player = players.get(playerId);
        if (player == null) {
            return false;
        }
        boolean changed = player.setConnected(connected, now);
        if (connected && phase == MatchPhase.LOBBY && players.values().stream().noneMatch(p -> p.isHost() && !p.hasLeft())) {
            nextHost().ifPresent(MatchPlayer::promoteToHost);
            changed = true;
        }
        return changed;
    }

    /**
     * Whether everyone still here has readied. Players whose socket has dropped are not
     * counted — otherwise one closed window holds the whole room until the failsafe.
     *
     * An entirely empty room returns false rather than true: with nobody connected the
     * check would otherwise be vacuously satisfied and start a match to an empty room.
     */
    private boolean everyPresentPlayerIsReady() {
        List<String> present = players.values().stream()
                // A bot has no briefing to read and never calls markReady, so counting one
                // would hold the gate shut until the failsafe expires.
                .filter(player -> !player.isBot())
                .filter(MatchPlayer::isConnected)
                .map(MatchPlayer::id)
                .toList();
        return !present.isEmpty() && readyIds.containsAll(present);
    }

    /**
     * Marks when the room emptied out, so something above can reap it.
     *
     * Tracked in every phase rather than only the lobby: a room whose players all vanish
     * during the briefing would otherwise wait out the failsafe and then play every round of
     * the match to nobody before any timer could touch it.
     *
     * Bots are not watchers. A practice room keeps its three opponents after its one human
     * closes the tab, and counting them would make exactly the rooms this exists for
     * immortal.
     */
    private void trackAbandonment(long now) {
        boolean watched = players.values().stream()
                .anyMatch(player -> !player.isBot() && player.isConnected());
        if (watched) {
            abandonedSinceMillis = 0;
        } else if (abandonedSinceMillis == 0) {
            abandonedSinceMillis = now;
        }
    }

    /** When the last human socket went away, or 0 while somebody is still here. */
    public synchronized long abandonedSinceMillis() {
        return abandonedSinceMillis;
    }

    public synchronized int readyCount() {
        return readyIds.size();
    }

    public synchronized Position openPosition(String playerId, Side side, double sizeFraction, int leverage, long now) {
        PlayerRound playerRound = tradingRound(playerId);
        if (playerRound.hasPosition()) {
            throw new IllegalStateException("A position is already open");
        }
        if (sizeFraction <= 0 || sizeFraction > 1) {
            throw new IllegalArgumentException("sizeFraction must be in (0, 1]");
        }
        // The floor is the match's, not the record's: Position keeps its own 1..MAX check
        // because that guards an invariant of the type, while this is a rule of this room.
        int floor = config.modifier().minLeverage();
        if (leverage < floor || leverage > Position.MAX_LEVERAGE) {
            throw new IllegalArgumentException(
                    "leverage must be between " + floor + " and " + Position.MAX_LEVERAGE);
        }
        if (playerRound.cash() <= 0) {
            throw new IllegalStateException("No cash left to trade");
        }
        // Notional is known before the fill: margin is cash * sizeFraction, exactly what
        // open() is about to post. Recording the kick here, before currentPrice(now) is
        // read below, is what makes the trader's own push land in their own fill price —
        // the thing that rules out opening, watching your own kick, and closing for free.
        // The four checks above run first so a call that WOULD be rejected records no kick
        // at all — otherwise a duplicate or malformed /open could push the price for free,
        // since PlayerRound.open()'s own rejection doesn't roll back a kick already recorded.
        double notional = playerRound.cash() * sizeFraction * leverage;
        impact.record(notional, side.direction(), referenceNotional, now);
        return playerRound.open(side, sizeFraction, leverage, currentPrice(now), now);
    }

    public synchronized double closePosition(String playerId, long now) {
        PlayerRound playerRound = tradingRound(playerId);
        if (playerRound.hasPosition()) {
            Position position = playerRound.position();
            impact.record(position.notional(), -position.side().direction(), referenceNotional, now);
        }
        // hasPosition() guards the impact recording only; close() still runs unconditionally
        // so a no-position call keeps throwing its existing "No position is open" exception.
        return playerRound.close(currentPrice(now));
    }

    /**
     * Records what a player says their tip is. The last word counts: changing your story is
     * allowed, and being held to the version you finished on is the point.
     *
     * Accepted from the intermission onwards, because that is when the tip is dealt and when
     * the room does most of its talking. A null claim leaves any earlier one standing, so
     * typing free text after using a quick-chat line does not quietly retract it.
     */
    public synchronized void recordTipClaim(String playerId, Regime claimed) {
        boolean roundIsLive = phase == MatchPhase.INTERMISSION || phase == MatchPhase.TRADING;
        if (claimed != null && roundIsLive && players.containsKey(playerId)) {
            tipClaims.put(playerId, claimed);
        }
    }

    private PlayerRound tradingRound(String playerId) {
        if (phase != MatchPhase.TRADING) {
            throw new IllegalStateException("The market is closed");
        }
        MatchPlayer player = players.get(playerId);
        if (player == null) {
            throw new IllegalArgumentException("Not in this match");
        }
        PlayerRound playerRound = player.round();
        if (playerRound == null) {
            throw new IllegalStateException("You joined mid-round — you're in from the next round");
        }
        return playerRound;
    }

    // --- reads ---------------------------------------------------------------

    /** During an intermission this is the upcoming round's opening price. */
    public synchronized double currentPrice(long now) {
        if (round == null) {
            return 0;
        }
        if (phase != MatchPhase.TRADING) {
            return round.path().startPrice();
        }
        double base = round.priceAt(now - roundStartedAtMillis);
        return base * (1 + impact.valueAt(now));
    }

    public synchronized double currentImpact(long now) {
        return impact == null ? 0.0 : impact.valueAt(now);
    }

    public synchronized List<Standing> standings() {
        List<MatchPlayer> ordered = new ArrayList<>(players.values());
        ordered.sort(Comparator.comparingDouble(MatchPlayer::totalScore)
                .thenComparingDouble(MatchPlayer::bestRound).reversed());

        List<Standing> standings = new ArrayList<>(ordered.size());
        for (int i = 0; i < ordered.size(); i++) {
            MatchPlayer player = ordered.get(i);
            standings.add(new Standing(
                    i + 1, player.id(), player.nickname(), player.totalScore(), player.bestRound()));
        }
        return List.copyOf(standings);
    }

    public synchronized Rumor rumorFor(String playerId) {
        return round == null ? null : round.rumorFor(playerId);
    }

    public String code() {
        return code;
    }

    public synchronized MatchConfig config() {
        return config;
    }

    /** One player's largest possible position — what a trade's impact is measured against. */
    public synchronized double referenceNotional() {
        return referenceNotional;
    }

    public synchronized MatchPhase phase() {
        return phase;
    }

    public synchronized boolean isPublic() {
        return isPublic;
    }

    /**
     * Deliberately allowed in any phase. It changes nothing about how a match plays — only
     * whether quick match can see it — so there is no state it could contradict.
     */
    public synchronized void setVisibility(boolean value) {
        isPublic = value;
    }

    public synchronized int roundIndex() {
        return roundIndex;
    }

    public synchronized long phaseEndsAtMillis() {
        return phaseEndsAtMillis;
    }

    /** The upcoming round during an intermission, the live one while trading. */
    public synchronized RoundPlan round() {
        return round;
    }

    /**
     * Every player, frozen against one price.
     *
     * The price is taken once inside this critical section rather than passed in, so a
     * caller cannot accidentally mix a stale price with fresh positions — which is what a
     * board assembled from separate getters used to do.
     *
     * Builds the round fields even for a lobby, where they are all zero. Cheaper than a
     * second method: a full pass over 150 rooms of game logic measures 169µs against a
     * 100ms budget, so this is not where any time goes.
     */
    public synchronized List<PlayerSnapshot> playerSnapshots(long now) {
        double price = currentPrice(now);
        List<PlayerSnapshot> snapshots = new ArrayList<>(players.size());
        for (MatchPlayer player : players.values()) {
            PlayerRound round = player.round();
            snapshots.add(new PlayerSnapshot(
                    player.id(),
                    player.nickname(),
                    player.isHost(),
                    player.isBot(),
                    player.isConnected(),
                    player.hasLeft(),
                    player.avatar(),
                    player.totalScore(),
                    round != null,
                    round == null ? 0 : round.cash(),
                    round == null ? 0 : round.equity(price),
                    round == null ? 0 : round.scoreAt(price),
                    round == null ? null : openOf(round, price)));
        }
        return List.copyOf(snapshots);
    }

    private static PlayerSnapshot.Open openOf(PlayerRound round, double price) {
        Position position = round.position();
        if (position == null) {
            return null;
        }
        return new PlayerSnapshot.Open(
                position.side().name(),
                position.margin(),
                position.leverage(),
                position.entryPrice(),
                position.liquidationPrice(),
                position.unrealisedPnl(price));
    }

    public synchronized int playerCount() {
        return players.size();
    }

    public synchronized List<String> playerIds() {
        return List.copyOf(players.keySet());
    }

    public synchronized boolean isHost(String playerId) {
        MatchPlayer player = players.get(playerId);
        return player != null && player.isHost();
    }

    public synchronized boolean isBot(String playerId) {
        MatchPlayer player = players.get(playerId);
        return player != null && player.isBot();
    }

    /**
     * People who are actually here: bots are filler and a player who pressed Leave has gone.
     * Both callers — the peak-concurrent counter and quick match's room ranking — want the
     * same answer, and quick match was previously counting the ones who left.
     */
    public synchronized long humanCount() {
        return players.values().stream()
                .filter(player -> !player.isBot() && !player.hasLeft())
                .count();
    }

    synchronized Collection<MatchPlayer> players() {
        return List.copyOf(players.values());
    }

    synchronized MatchPlayer player(String playerId) {
        return players.get(playerId);
    }

    public synchronized boolean hasPlayer(String playerId) {
        return players.containsKey(playerId);
    }

    public synchronized Map<String, Regime> tipClaims() {
        return Map.copyOf(tipClaims);
    }

    public synchronized boolean isEmpty() {
        return activePlayerIds().isEmpty();
    }
}
