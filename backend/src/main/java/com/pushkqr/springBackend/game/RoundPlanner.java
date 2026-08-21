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

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

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
                asset.basePrice(), regime, config.priceSteps(), MatchConfig.STEP_MILLIS, random.nextLong(),
                config.volatilityMultiplier());

        Map<String, Rumor> rumors = rumors(regime, asset, playerIds, random, config);

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
    private Map<String, Rumor> rumors(Regime regime, Asset asset, Collection<String> playerIds,
            Random random, MatchConfig config) {
        List<String> ordered = playerIds.stream().sorted().toList();
        if (ordered.isEmpty()) {
            return Map.of();
        }

        // Who holds a real tip is drawn here rather than per player, so shuffle the roster and
        // take the first few. Shuffling a copy of the sorted list keeps this reproducible from
        // the seed, which the whole "rematch on the same market" promise rests on.
        List<String> shuffled = new ArrayList<>(ordered);
        Collections.shuffle(shuffled, random);

        // Unconditional, including when the count below is zero and the result goes unused.
        // Not for determinism — the price path is already drawn by the time this runs, so a
        // draw taken here cannot move the market — but because a branch whose only effect is
        // on the shape of the random stream is a thing nobody can reason about later.
        int truthful = config.modifier().allTipsLie() ? 0 : truthfulTipCount(ordered.size(), random);
        Set<String> holdsTruth = Set.copyOf(shuffled.subList(0, truthful));

        Map<String, Rumor> rumors = new LinkedHashMap<>();
        for (String id : ordered) {
            rumors.put(id, holdsTruth.contains(id)
                    ? scripter.truthfulRumorFor(regime, asset.ticker(), random)
                    : scripter.falseRumorFor(regime, asset.ticker(), random));
        }

        return Map.copyOf(rumors);
    }

    /**
     * How many of the room's tips are real: somewhere around half, never all and never none.
     *
     * Tips used to be drawn independently at a fixed probability, which put the count on a
     * binomial and let it land anywhere. That reads fine at twelve seats and falls apart at
     * four, where it dealt a single true tip in 47% of rounds and made every one of them true
     * in another 3% — half of all four-player rounds arriving in a state where nobody has to
     * deduce anything. If one tip in four is real, everybody correctly assumes theirs is the
     * lie; if every tip is real, nobody has to lie at all. Both are the same failure: the
     * count answers the question the round exists to ask.
     *
     * Around half is where the count says least and the room has to talk most. The band is
     * deliberately a band and not a fixed n/2 — a number that never moves is one nobody needs
     * to hear twice — but it is narrow, and it excludes the ends by construction rather than
     * by clamping afterwards. Two seats collapse to one true tip because that is the only
     * value which is neither nobody nor everybody.
     *
     * Bots are seats like any other here, so a solo practice match against three of them is a
     * four-player room and gets the same treatment.
     */
    static int truthfulTipCount(int players, Random random) {
        if (players <= 1) {
            return players;
        }
        int low = Math.max(1, (int) Math.round(players * 0.4));
        int high = Math.min(players - 1, (int) Math.round(players * 0.6));
        if (low > high) {
            low = high;
        }
        return low + random.nextInt(high - low + 1);
    }
}
