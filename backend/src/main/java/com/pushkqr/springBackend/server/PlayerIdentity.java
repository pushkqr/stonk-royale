package com.pushkqr.springBackend.server;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

/**
 * Turns an optional bearer token into a player id.
 *
 * Signing in is never required — the design treats a login wall as the single biggest
 * reason someone never tries the game. A signed-in player gets a stable id across matches.
 * A guest gets one that lasts as long as their browser keeps its device id, which is what
 * lets somebody whose tab died be handed their own seat back instead of being told their
 * own name is taken. Everything downstream treats them identically.
 */
@Service
public class PlayerIdentity {

    private static final Logger logger = LoggerFactory.getLogger(PlayerIdentity.class);
    private static final String BEARER = "Bearer ";

    private final Optional<FirebaseApp> firebase;

    public PlayerIdentity(Optional<FirebaseApp> firebase) {
        this.firebase = firebase;
        if (firebase.isEmpty()) {
            logger.info("Firebase is not configured — sign-in is unavailable, guests can still play.");
        }
    }

    public String resolve(String authorizationHeader, String deviceId) {
        return verifiedUid(authorizationHeader)
                .map(uid -> "user:" + uid)
                .orElseGet(() -> guest(deviceId));
    }

    /**
     * A guest is recognised by the id their own browser generated and kept. Without one
     * there is nothing to recognise them by, so they get a fresh identity — the old
     * behaviour, and still the right one for a client that sends no device id at all.
     */
    private static String guest(String deviceId) {
        return deviceId == null || deviceId.isBlank()
                ? "guest:" + UUID.randomUUID()
                : "guest:" + deviceId;
    }

    private Optional<String> verifiedUid(String authorizationHeader) {
        if (firebase.isEmpty() || authorizationHeader == null || !authorizationHeader.startsWith(BEARER)) {
            return Optional.empty();
        }
        try {
            return Optional.of(FirebaseAuth.getInstance(firebase.get())
                    .verifyIdToken(authorizationHeader.substring(BEARER.length()))
                    .getUid());
        } catch (Exception e) {
            // A bad token means "play as a guest", not "reject the player".
            logger.debug("Token verification failed, continuing as guest: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
