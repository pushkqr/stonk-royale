package com.pushkqr.springBackend.server;

import com.pushkqr.springBackend.game.Match;
import com.pushkqr.springBackend.game.model.MatchConfig;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Every live match, held in memory. Nothing here survives a restart, by design. */
@Component
public class MatchRegistry {

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 5;

    /**
     * How many live rooms this box will carry.
     *
     * Every match is advanced by one scheduled thread inside a 100ms budget, so past a
     * point a new room does not merely run badly on its own — it makes every existing room
     * late. Refusing a host who has not started yet is the cheapest thing there is to give
     * up; the alternative is a stutter for everyone already mid-round.
     *
     * Tuned against tickWorstMillis on the admin panel rather than guessed: raise it while
     * the worst pass stays comfortably inside its budget under real load.
     */
    public static final int MAX_LIVE_MATCHES = 150;

    private final Map<String, Match> matches = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    public Match create(MatchConfig config) {
        if (matches.size() >= MAX_LIVE_MATCHES) {
            throw new IllegalStateException(
                    "The server is busy — every room is in use. Try again in a minute.");
        }
        String code = uniqueCode();
        Match match = new Match(code, config);
        matches.put(code, match);
        return match;
    }

    public Match get(String code) {
        return code == null ? null : matches.get(code.toUpperCase());
    }

    public Collection<Match> all() {
        return List.copyOf(matches.values());
    }

    public void remove(String code) {
        matches.remove(code);
    }

    /**
     * Ambiguous glyphs (I, O, 0, 1) are left out — codes get read aloud and typed in by
     * hand, so O-versus-0 is a real failure mode.
     */
    private String uniqueCode() {
        while (true) {
            StringBuilder code = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                code.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            String candidate = code.toString();
            if (!matches.containsKey(candidate)) {
                return candidate;
            }
        }
    }
}
