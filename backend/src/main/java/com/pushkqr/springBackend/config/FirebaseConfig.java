package com.pushkqr.springBackend.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.boot.autoconfigure.condition.ConditionalOnResource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.io.InputStream;

/**
 * Firebase is optional.
 *
 * Without {@code serviceAccount.json} the bean is simply absent and the game runs
 * guest-only. Nobody should need a Firebase project in hand just to start the server.
 */
@Configuration
@ConditionalOnResource(resources = "classpath:serviceAccount.json")
public class FirebaseConfig {

    @Bean
    public FirebaseApp initFirebase() throws IOException {
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }
        try (InputStream serviceAccount = new ClassPathResource("serviceAccount.json").getInputStream()) {
            return FirebaseApp.initializeApp(FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .build());
        }
    }
}
