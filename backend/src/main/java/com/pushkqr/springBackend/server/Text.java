package com.pushkqr.springBackend.server;

/**
 * Nicknames and chat come from anonymous strangers with no account behind them, so every
 * string from a client is trimmed, length-capped and stripped of control characters
 * before it reaches anyone else's screen.
 */
final class Text {

    private static final int MAX_NICKNAME = 16;
    private static final int MAX_CHAT = 200;

    private Text() {
    }

    static String nickname(String raw) {
        String cleaned = clean(raw, MAX_NICKNAME);
        return cleaned.isEmpty() ? "anon" : cleaned;
    }

    /** Returns an empty string for messages that are not worth broadcasting. */
    static String chat(String raw) {
        return clean(raw, MAX_CHAT);
    }

    /** Sub-dollar assets need more decimals than a stock ticker would. */
    public static String price(double value) {
        return value >= 1 ? String.format("$%,.2f", value) : String.format("$%.4f", value);
    }

    private static String clean(String raw, int maxLength) {
        if (raw == null) {
            return "";
        }
        String cleaned = raw.replaceAll("\\p{Cntrl}", "").trim();
        return cleaned.length() > maxLength ? cleaned.substring(0, maxLength) : cleaned;
    }
}
