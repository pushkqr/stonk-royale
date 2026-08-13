package com.pushkqr.springBackend.exceptions;

public class MatchNotFoundException extends RuntimeException {

    public MatchNotFoundException(String message) {
        super(message);
    }
}
