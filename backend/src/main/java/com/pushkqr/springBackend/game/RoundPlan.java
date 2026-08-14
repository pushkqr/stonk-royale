package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.bot.BotScript;
import com.pushkqr.springBackend.game.info.MarketEvent;
import com.pushkqr.springBackend.game.info.Rumor;
import com.pushkqr.springBackend.game.model.Asset;
import com.pushkqr.springBackend.game.sim.PricePath;
import com.pushkqr.springBackend.game.sim.Regime;

import java.util.List;
import java.util.Map;

/**
 * Everything about one round, decided before it starts: the asset, the hidden regime,
 * the full price path, the public headlines, and each player's private rumor.
 */
public record RoundPlan(
        int roundIndex,
        Asset asset,
        Regime regime,
        PricePath path,
        List<MarketEvent> events,
        Map<String, Rumor> rumors,
        BotScript botScript) {

    public Rumor rumorFor(String playerId) {
        return rumors.get(playerId);
    }

    /**
     * How many players hold a true tip. Public knowledge, unlike which players they are:
     * it is what makes a claim on the wire checkable, since three people claiming PUMP
     * against a count of one means two of them are lying right now.
     */
    public int truthfulTipCount() {
        return (int) rumors.values().stream().filter(rumor -> rumor.truthful()).count();
    }

    public double priceAt(long elapsedMillis) {
        return path.priceAt(elapsedMillis);
    }
}
