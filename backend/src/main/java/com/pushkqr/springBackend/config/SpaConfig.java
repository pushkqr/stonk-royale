package com.pushkqr.springBackend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Hands client-side routes back to the app shell.
 *
 * Invite links point straight at /m/CODE, so that path has to return index.html on a cold
 * load rather than a 404 — otherwise every shared link is broken.
 */
@Configuration
public class SpaConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/m/{code}").setViewName("forward:/index.html");
    }
}
