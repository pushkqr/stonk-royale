package com.pushkqr.springBackend.exceptions;

/**
 * The request was fine and the client simply made too many of them.
 *
 * Its own type rather than an IllegalStateException, which the advice maps to 409. A 409 says
 * the game refused — the room is full, the market is shut — and a client cannot tell from it
 * that waiting would help. 429 can, and says how this one differs from every other refusal:
 * nothing is wrong, come back in a moment.
 */
public class TooManyRequestsException extends RuntimeException {

    public TooManyRequestsException(String message) {
        super(message);
    }
}
