package com.pushkqr.springBackend.game;

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
        Map<String, Rumor> rumors) {

    public Rumor rumorFor(String playerId) {
        return rumors.get(playerId);
    }

    public double priceAt(long elapsedMillis) {
        return path.priceAt(elapsedMillis);
    }
}
