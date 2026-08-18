package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.admin.Stats;
import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.MatchPhase;
import com.pushkqr.springBackend.game.MatchPlayer;
import com.pushkqr.springBackend.game.model.MatchConfig;
import com.pushkqr.springBackend.exceptions.MatchNotFoundException;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/api/match")
public class MatchController {

    private final MatchRegistry matches;
    private final SessionRegistry sessions;
    private final PlayerIdentity identity;
    private final MatchBroadcaster broadcaster;
    private final Stats stats;

    public MatchController(MatchRegistry matches, SessionRegistry sessions,
            PlayerIdentity identity, MatchBroadcaster broadcaster, Stats stats) {
        this.matches = matches;
        this.sessions = sessions;
        this.identity = identity;
        this.broadcaster = broadcaster;
        this.stats = stats;
    }

    @PostMapping
    public Views.JoinResult create(@RequestBody Requests.Create request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Match match = matches.create(configFor(request));
        match.setVisibility(Boolean.TRUE.equals(request.isPublic()));
        stats.matchCreated();
        return seat(match, request.nickname(), authorization, request.deviceId());
    }

    /**
     * A short solo match against scripted opponents, started immediately.
     *
     * Without this, a first-time visitor with nobody else around cannot see the game at
     * all — the lobby needs a second player — so every unaccompanied arrival bounces
     * having learned nothing.
     *
     * The bots are not decoration. They hold real positions, so their trading pushes the
     * price the player is trading against; they place in the standings, so a score means
     * something; and one of them lies about its tip every round, so the information layer
     * is playable alone. Three rounds rather than one because a single tip and a single
     * entry is not enough to read a room.
     */
    @PostMapping("/practice")
    public Views.JoinResult practice(@RequestBody Requests.Join request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Match match = matches.create(new MatchConfig(3, 60, 20, 10_000, MatchConfig.MAX_PLAYERS));
        stats.matchCreated();
        Views.JoinResult seat = seat(match, request.nickname(), authorization, request.deviceId());
        Bots.fill(match, Bots.BOT_COUNT);
        long now = System.currentTimeMillis();
        match.start(now);
        // Ready, but deliberately not advanced: the engine owns every phase transition and
        // will pick this up within 100ms, well before the client's socket has connected. A
        // tick from this thread would race the engine's own and drop the events it returns.
        if (Boolean.TRUE.equals(request.skipBriefing())) {
            match.markReady(seat.playerId());
        }
        broadcaster.phase(match);
        return seat;
    }

    /**
     * Drops a player into a game without needing a code from anybody.
     *
     * Joins the fullest public room still waiting to start, or makes one if there is none.
     * A new one is seated with bots on purpose: an empty lobby is a worse answer than no
     * button at all, and because the room stays public and unstarted, the next person to
     * press this lands in it rather than in a room of their own.
     */
    @PostMapping("/quick")
    public Views.JoinResult quick(@RequestBody Requests.Join request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Match waiting = openPublicRoom();
        if (waiting != null) {
            try {
                Views.JoinResult seat = seat(waiting, request.nickname(), authorization,
                        request.deviceId());
                broadcaster.lobby(waiting);
                return seat;
            } catch (IllegalStateException full) {
                // Somebody took the last chair between the scan and the sit. Rare, and not
                // worth locking the registry over — fall through and make a fresh room.
            }
        }

        Match match = matches.create(MatchConfig.standard());
        match.setVisibility(true);
        stats.matchCreated();
        Views.JoinResult seat = seat(match, request.nickname(), authorization, request.deviceId());
        Bots.fill(match, Bots.BOT_COUNT);
        return seat;
    }

    /**
     * The public room worth joining, or null.
     *
     * Lobby only — quick match never drops somebody into a round already running, even
     * though joining mid-match is allowed generally. Fullest first, so a group pressing the
     * button in the same minute converges on one room instead of scattering into several
     * and each playing alone against bots.
     */
    private Match openPublicRoom() {
        return matches.all().stream()
                .filter(Match::isPublic)
                .filter(match -> match.phase() == MatchPhase.LOBBY)
                .filter(match -> match.players().size() < match.config().maxPlayers())
                .max(Comparator.comparingLong(MatchController::humanCount))
                .orElse(null);
    }

    /** Bots do not count towards how worth joining a room is — they are the filler. */
    private static long humanCount(Match match) {
        return match.players().stream().filter(player -> !player.isBot()).count();
    }

    @PostMapping("/{code}/join")
    public Views.JoinResult join(@PathVariable String code, @RequestBody Requests.Join request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Match match = require(code);
        Views.JoinResult result = seat(match, request.nickname(), authorization, request.deviceId());
        broadcaster.lobby(match);
        return result;
    }

    @GetMapping("/{code}")
    public Views.Lobby lobby(@PathVariable String code) {
        return broadcaster.lobbyView(require(code));
    }

    private Views.JoinResult seat(Match match, String requestedNickname, String authorization,
            String deviceId) {
        String nickname = Text.nickname(requestedNickname);
        MatchPlayer player = match.join(identity.resolve(authorization, deviceId), nickname);
        PlayerSession session = sessions.create(match.code(), player.id(), nickname);
        stats.seatTaken(deviceId);

        return new Views.JoinResult(
                match.code(), player.id(), player.nickname(), session.token(), player.isHost());
    }

    private Match require(String code) {
        Match match = matches.get(code);
        if (match == null) {
            throw new MatchNotFoundException("No match with code " + code);
        }
        return match;
    }

    /**
     * Anything the host left alone keeps its default. Out-of-range values are rejected by
     * {@link MatchConfig} itself and surface as a 400, so the UI's limits are a
     * convenience rather than the actual guard.
     */
    private MatchConfig configFor(Requests.Create request) {
        MatchConfig standard = MatchConfig.standard();
        return new MatchConfig(
                orDefault(request.rounds(), standard.rounds()),
                orDefault(request.roundSeconds(), standard.roundSeconds()),
                orDefault(request.intermissionSeconds(), standard.intermissionSeconds()),
                request.startingCash() == null ? standard.startingCash() : request.startingCash(),
                orDefault(request.maxPlayers(), standard.maxPlayers()),
                request.volatilityMultiplier() == null ? standard.volatilityMultiplier() : request.volatilityMultiplier(),
                request.marketImpactMultiplier() == null ? standard.marketImpactMultiplier() : request.marketImpactMultiplier());
    }

    private static int orDefault(Integer value, int fallback) {
        return value == null ? fallback : value;
    }
}
