package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.bot.BotScripter;
import com.pushkqr.springBackend.game.info.InformationScripter;
import com.pushkqr.springBackend.game.info.Rumor;
import com.pushkqr.springBackend.game.model.Asset;
import com.pushkqr.springBackend.game.model.AssetCatalog;
import com.pushkqr.springBackend.game.model.MatchConfig;
import com.pushkqr.springBackend.game.sim.MarketSimulator;
import com.pushkqr.springBackend.game.sim.PricePath;
import com.pushkqr.springBackend.game.sim.Regime;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Assembles a round from a match seed and round number.
 *
 * Everything derives from those two values, so replaying a seed reproduces the market
 * exactly. That is what makes "rematch on the same market" a fair comparison, and what
 * makes any reported bug reproducible from its seed alone.
 */
public final class RoundPlanner {

    private final MarketSimulator simulator = new MarketSimulator();
    private final InformationScripter scripter = new InformationScripter();
    private final BotScripter botScripter = new BotScripter();

    public RoundPlan plan(long matchSeed, int roundIndex, Collection<String> playerIds,
            Collection<String> botIds, MatchConfig config) {
        Random random = new Random(matchSeed * 1_000_003L + roundIndex);

        Asset asset = AssetCatalog.shuffled(matchSeed).get(roundIndex % AssetCatalog.size());
        Regime regime = Regime.values()[random.nextInt(Regime.values().length)];

        PricePath path = simulator.generate(
                asset.basePrice(), regime, config.priceSteps(), MatchConfig.STEP_MILLIS, random.nextLong());

        Map<String, Rumor> rumors = rumors(regime, asset, playerIds, random);

        // Sorted for the same reason the rumors are: the bot script must not depend on the
        // order seats happen to sit in a map.
        List<String> orderedBots = botIds.stream().sorted().toList();

        return new RoundPlan(
                roundIndex,
                asset,
                regime,
                path,
                scripter.eventsFor(regime, asset.ticker(), config.roundMillis(), random),
                rumors,
                botScripter.script(regime, config.roundMillis(), config.intermissionMillis(),
                        orderedBots, rumors, random));
    }

    /** Sorted iteration keeps rumor assignment deterministic whatever order players arrive in. */
    private Map<String, Rumor> rumors(Regime regime, Asset asset, Collection<String> playerIds, Random random) {
        List<String> ordered = playerIds.stream().sorted().toList();

        Map<String, Rumor> rumors = new LinkedHashMap<>();
        for (String id : ordered) {
            rumors.put(id, scripter.rumorFor(regime, asset.ticker(), random));
        }

        // Independent draws can leave a round with no true tip at all, and such a round has
        // nothing for the table to converge on: no claim can be checked against anything, so
        // talking stops paying and the round decays into a coin flip. One tip is always real.
        if (!ordered.isEmpty() && rumors.values().stream().noneMatch(rumor -> rumor.truthful())) {
            String holder = ordered.get(random.nextInt(ordered.size()));
            rumors.put(holder, scripter.truthfulRumorFor(regime, asset.ticker(), random));
        }

        return Map.copyOf(rumors);
    }
}
