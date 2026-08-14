package com.pushkqr.springBackend.game.bot;

/**
 * How one bot plays a single round.
 *
 * Assigned per round rather than per bot, and shuffled every time. A name that read the
 * market correctly three rounds running stops being an opponent and becomes an oracle —
 * the human would simply copy it, and both the trading and the lying would be over.
 */
public enum BotPersona {

    /** Reads the round right and commits, but only once it is safe to. */
    SHARP,

    /** Sincerely, expensively wrong: the wrong side, too much leverage, held too long. */
    MARK,

    /** Never convinced of anything. In and out, small, survives. */
    CHOPPER
}
