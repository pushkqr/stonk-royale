package com.pushkqr.springBackend.dto;

import java.time.OffsetDateTime;

public class ChatMessage {
    public String username;
    public String text;
    public OffsetDateTime timsetamp;

    public ChatMessage() {
    }

    public ChatMessage(OffsetDateTime timsetamp, String text, String username) {
        this.timsetamp = timsetamp;
        this.text = text;
        this.username = username;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public OffsetDateTime getTimsetamp() {
        return timsetamp;
    }

    public void setTimsetamp(OffsetDateTime timsetamp) {
        this.timsetamp = timsetamp;
    }
}
