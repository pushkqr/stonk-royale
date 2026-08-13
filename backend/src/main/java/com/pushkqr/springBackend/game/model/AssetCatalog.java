package com.pushkqr.springBackend.game.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

public final class AssetCatalog {

    private static final List<Asset> ASSETS = List.of(
            new Asset("SOLARIS", "Definitely not a Ponzi. Definitely.", 42.50),
            new Asset("DOGZ", "It's a dog. That's the whole thesis.", 0.0420),
            new Asset("MOONR", "The whitepaper was a single emoji.", 1.37),
            new Asset("VOID", "Backed by absolutely nothing.", 88.00),
            new Asset("NUKE", "Volatility is a feature, not a bug.", 6.90),
            new Asset("HYPR", "Ten thousand transactions per second, zero users.", 215.00),
            new Asset("GRIFT", "At least it's honest about it.", 0.69),
            new Asset("BAGZ", "Someone has to hold them.", 13.37));

    private AssetCatalog() {
    }

    /**
     * A deterministic ordering for one match. Rounds draw from this in sequence, so a
     * match never repeats an asset and every asset keeps its own starting price.
     */
    public static List<Asset> shuffled(long seed) {
        List<Asset> order = new ArrayList<>(ASSETS);
        Collections.shuffle(order, new Random(seed));
        return List.copyOf(order);
    }

    public static int size() {
        return ASSETS.size();
    }
}
