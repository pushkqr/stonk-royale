package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.admin.Stats;
import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.MatchPlayer;
import com.pushkqr.springBackend.game.model.MatchConfig;
import com.pushkqr.springBackend.exceptions.MatchNotFoundException;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/match")
public class MatchController {

    /** Deliberately unremarkable names — a bot should read as another player, not a robot. */
    private static final List<String> BOT_NAMES = List.of("Vega", "Kite", "Moss", "Pike", "Otto");

    private static final int BOT_COUNT = 3;

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
        seatBots(match, seat.nickname());
        long now = System.currentTimeMillis();
        match.start(now);
        if (Boolean.TRUE.equals(request.skipBriefing())) {
            match.markReady(seat.playerId());
            match.tick(now);
        }
        broadcaster.phase(match);
        return seat;
    }

    /**
     * The "bot:" prefix keeps these ids clear of {@link PlayerIdentity}'s, which are Firebase
     * uids or generated guest ids — a collision would hand a bot's seat to a person.
     */
    private void seatBots(Match match, String humanNickname) {
        List<String> available = BOT_NAMES.stream()
                // Two "Moss" in a four-player room makes the standings unreadable and every
                // accusation ambiguous.
                .filter(name -> !name.equalsIgnoreCase(humanNickname))
                .toList();

        for (int i = 0; i < BOT_COUNT; i++) {
            match.addBot("bot:" + i, available.get(i));
        }
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
        MatchPlayer player = match.join(identity.resolve(authorization), nickname);
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
                orDefault(request.maxPlayers(), standard.maxPlayers()));
    }

    private static int orDefault(Integer value, int fallback) {
        return value == null ? fallback : value;
    }
}
