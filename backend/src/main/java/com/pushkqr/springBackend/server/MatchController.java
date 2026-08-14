package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.MatchPlayer;
import com.pushkqr.springBackend.game.model.MatchConfig;
import com.pushkqr.springBackend.exceptions.MatchNotFoundException;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/match")
public class MatchController {

    private final MatchRegistry matches;
    private final SessionRegistry sessions;
    private final PlayerIdentity identity;
    private final MatchBroadcaster broadcaster;

    public MatchController(MatchRegistry matches, SessionRegistry sessions,
            PlayerIdentity identity, MatchBroadcaster broadcaster) {
        this.matches = matches;
        this.sessions = sessions;
        this.identity = identity;
        this.broadcaster = broadcaster;
    }

    @PostMapping
    public Views.JoinResult create(@RequestBody Requests.Create request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Match match = matches.create(configFor(request));
        return seat(match, request.nickname(), authorization);
    }

    /**
     * A one-round solo match, started immediately.
     *
     * Without this, a first-time visitor with nobody else around cannot see the game at
     * all — the lobby needs a second player — so every unaccompanied arrival bounces
     * having learned nothing.
     */
    @PostMapping("/practice")
    public Views.JoinResult practice(@RequestBody Requests.Join request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Match match = matches.create(new MatchConfig(1, 60, 8, 10_000, MatchConfig.MAX_PLAYERS));
        Views.JoinResult seat = seat(match, request.nickname(), authorization);
        match.start(System.currentTimeMillis());
        broadcaster.phase(match);
        return seat;
    }

    @PostMapping("/{code}/join")
    public Views.JoinResult join(@PathVariable String code, @RequestBody Requests.Join request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        Match match = require(code);
        Views.JoinResult result = seat(match, request.nickname(), authorization);
        broadcaster.lobby(match);
        return result;
    }

    @GetMapping("/{code}")
    public Views.Lobby lobby(@PathVariable String code) {
        return broadcaster.lobbyView(require(code));
    }

    private Views.JoinResult seat(Match match, String requestedNickname, String authorization) {
        String nickname = Text.nickname(requestedNickname);
        MatchPlayer player = match.join(identity.resolve(authorization), nickname);
        PlayerSession session = sessions.create(match.code(), player.id(), nickname);

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
