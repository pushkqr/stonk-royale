package com.pushkqr.springBackend.game.bot;

import java.util.List;

/**
 * A round's whole bot plan.
 *
 * Two lists because they belong to two different phases and are drained against two
 * different clocks: {@code chatter} runs on the intermission's, {@code actions} on the
 * round's. Folding them into one would mean storing which phase each entry meant.
 *
 * @param chatter what the bots claim their tips said, timed from the intermission's start
 * @param actions trades and mid-round talk, timed from the round's start
 */
public record BotScript(List<BotAction.Say> chatter, List<BotAction> actions) {
}
