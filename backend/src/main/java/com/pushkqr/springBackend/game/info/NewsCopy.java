package com.pushkqr.springBackend.game.info;

import com.pushkqr.springBackend.game.sim.Regime;

import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Text for rumors and headlines, keyed by the regime they claim.
 *
 * Truthful and false copy is drawn from the same pools, so wording can never give away
 * which is which — only the claimed regime differs.
 */
final class NewsCopy {

    private static final Map<Regime, List<String>> RUMORS = Map.of(
            Regime.PUMP, List.of(
                    "Word is $%s is about to rip.",
                    "Big money's been loading $%s all morning.",
                    "My cousin works there. $%s is going up."),
            Regime.DUMP, List.of(
                    "Heard $%s is getting dumped hard.",
                    "Someone's unloading a massive $%s bag.",
                    "$%s is done. Everyone's heading for the exit."),
            Regime.CHOP, List.of(
                    "$%s is going nowhere today. Pure chop.",
                    "Nobody's touching $%s. Dead flat.",
                    "$%s traders are all asleep. Nothing's moving."),
            Regime.RUG, List.of(
                    "The $%s devs are moving wallets. Get out.",
                    "$%s liquidity is about to vanish. Don't be last.",
                    "Something's wrong with $%s. The team's gone quiet."),
            Regime.SQUEEZE, List.of(
                    "$%s shorts are trapped. Squeeze incoming.",
                    "Everyone's short $%s. That never ends well.",
                    "$%s is about to melt every short in the room."));

    /**
     * No leading icons: a symbol keyed to the regime would tell a player at a glance what
     * the headline claims, and doing that consistently would let them classify headlines
     * without reading them.
     */
    private static final Map<Regime, List<String>> HEADLINES = Map.of(
            Regime.PUMP, List.of(
                    "$%s NAMED TOP PICK BY MAJOR DESK",
                    "INSTITUTIONAL INFLOWS INTO $%s HIT RECORD"),
            Regime.DUMP, List.of(
                    "$%s DOWNGRADED ACROSS THE STREET",
                    "EARLY BACKERS SEEN EXITING $%s"),
            Regime.CHOP, List.of(
                    "$%s VOLUME DRIES UP, TRADERS SIDELINED",
                    "ANALYSTS SPLIT ON $%s, NO CONSENSUS"),
            Regime.RUG, List.of(
                    "$%s DEV WALLET MOVING",
                    "REGULATORS OPEN PROBE INTO $%s"),
            Regime.SQUEEZE, List.of(
                    "$%s SHORT INTEREST HITS ALL-TIME HIGH",
                    "$%s FLOAT LOCKED UP, BORROW UNAVAILABLE"));

    private NewsCopy() {
    }

    static String rumor(Regime regime, String ticker, Random random) {
        return pick(RUMORS.get(regime), ticker, random);
    }

    static String headline(Regime regime, String ticker, Random random) {
        return pick(HEADLINES.get(regime), ticker, random);
    }

    private static String pick(List<String> pool, String ticker, Random random) {
        return String.format(pool.get(random.nextInt(pool.size())), ticker);
    }
}
