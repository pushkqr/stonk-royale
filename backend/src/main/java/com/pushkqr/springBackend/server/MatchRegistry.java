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

    private final Map<String, Match> matches = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    public Match create(MatchConfig config) {
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
