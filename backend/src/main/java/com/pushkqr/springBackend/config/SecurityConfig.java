package com.pushkqr.springBackend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

/**
 * The game itself is open.
 *
 * Authorisation happens inside the game instead: joining hands back a session token, and
 * {@link com.pushkqr.springBackend.server.StompAuthInterceptor} requires it on the socket
 * where the actual trading happens. HTTP only ever creates or reads a lobby.
 *
 * The one exception is {@code /api/admin/**}, which reports who is playing and how the
 * server is holding up. That is behind HTTP Basic — adequate because Caddy terminates TLS
 * in front of it, so the credentials are never on the wire in the clear.
 *
 * <p><b>It fails closed.</b> With no {@code ADMIN_PASSWORD} set there is no account to log
 * in as, and every admin request is refused. A default password would be worse than no
 * panel at all, because it would be a published one.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final Logger logger = LoggerFactory.getLogger(SecurityConfig.class);

    private final String adminPassword;

    public SecurityConfig(@Value("${stonk.admin-password:}") String adminPassword) {
        this.adminPassword = adminPassword == null ? "" : adminPassword.strip();
    }

    private boolean adminEnabled() {
        return !adminPassword.isEmpty();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity httpSecurity) throws Exception {
        httpSecurity.cors(Customizer.withDefaults());
        httpSecurity.csrf(csrf -> csrf.disable());
        httpSecurity.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        if (adminEnabled()) {
            httpSecurity.authorizeHttpRequests(auth -> auth
                    .requestMatchers("/api/admin/**").authenticated()
                    .anyRequest().permitAll());
            httpSecurity.httpBasic(Customizer.withDefaults());
        } else {
            logger.info("ADMIN_PASSWORD is not set — the admin panel is disabled.");
            httpSecurity.authorizeHttpRequests(auth -> auth
                    .requestMatchers("/api/admin/**").denyAll()
                    .anyRequest().permitAll());
        }

        return httpSecurity.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Hashed at startup rather than compared as text, so the password does not sit in
     * memory in the clear for the life of the process.
     */
    @Bean
    public InMemoryUserDetailsManager adminUser(PasswordEncoder encoder) {
        if (!adminEnabled()) {
            return new InMemoryUserDetailsManager();
        }
        return new InMemoryUserDetailsManager(User.withUsername("admin")
                .password(encoder.encode(adminPassword))
                .roles("ADMIN")
                .build());
    }
}
