package com.pushkqr.springBackend.game.bot;

import com.pushkqr.springBackend.game.info.Rumor;
import com.pushkqr.springBackend.game.model.Side;
import com.pushkqr.springBackend.game.sim.Regime;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Authors a round's entire bot script before the round opens.
 *
 * Every bot decision is made here, once, from the round's seeded {@code Random}. Nothing
 * about a bot is decided while the market is running — which is what keeps a round
 * reproducible from its seed, keeps the tick loop free of judgement, and means a bot can
 * be reasoned about by reading a list instead of simulating a mind.
 */
public final class BotScripter {

    /** Where a bot that trades the whole round gets in, as a fraction of the round. */
    private static final double MARK_ENTRY = 0.10;
    private static final double SHARP_ENTRY = 0.15;

    /** Breathing room after a shock begins, so SHARP is reacting to it rather than to nothing. */
    private static final long SHARP_SHOCK_LAG_MILLIS = 1_000;

    private static final double CHOPPER_FIRST_ENTRY = 0.08;
    private static final double CHOPPER_FIRST_EXIT = 0.40;
    private static final double CHOPPER_SECOND_ENTRY = 0.50;
    private static final double CHOPPER_SECOND_EXIT = 0.80;

    /** Enough that entries do not land on a metronome, small enough not to reorder them. */
    private static final long JITTER_MILLIS = 1_500;

    /** A bot announces its position just after taking it, the way a person would. */
    private static final long BRAG_LAG_MILLIS = 1_200;

    /** Spread across the intermission so the room reads as a conversation, not a dump. */
    private static final double[] CLAIM_SLOTS = {0.15, 0.40, 0.65};

    public BotScript script(Regime regime, long roundMillis, long intermissionMillis,
            List<String> botIds, Map<String, Rumor> rumors, Random random) {

        if (botIds.isEmpty()) {
            return new BotScript(List.of(), List.of());
        }

        List<BotPersona> personas = new ArrayList<>(List.of(BotPersona.values()));
        // Shuffled with the round's own Random so the assignment is reproducible, and so no
        // bot is the reliable one two rounds running.
        java.util.Collections.shuffle(personas, random);

        // Drawn once for the whole room, not once per bot. CHOP has no favoured side and
        // settles it on a coin flip, so re-drawing inside the loop would let SHARP and MARK
        // land on the same side of the same round — leaving the round with no wrong bot in
        // it at all, which is half of what the three archetypes are for.
        Side paying = payingSide(regime, random);

        List<BotAction> actions = new ArrayList<>();
        for (int i = 0; i < botIds.size(); i++) {
            String botId = botIds.get(i);
            BotPersona persona = personas.get(i % personas.size());
            actions.addAll(tradesFor(persona, botId, paying, regime, roundMillis, random));
        }
        actions.sort(Comparator.comparingLong(BotAction::atMillis));

        List<BotAction.Say> chatter =
                claimsFor(botIds, rumors, intermissionMillis, random);

        return new BotScript(List.copyOf(chatter), List.copyOf(actions));
    }

    // --- trading -------------------------------------------------------------

    private List<BotAction> tradesFor(BotPersona persona, String botId, Side paying,
            Regime regime, long roundMillis, Random random) {
        List<BotAction> actions = new ArrayList<>();

        switch (persona) {
            case SHARP -> {
                long at = sharpEntry(regime, roundMillis, random);
                actions.add(new BotAction.Open(at, botId, paying, 0.70, 4));
                actions.add(new BotAction.Say(
                        clamp(at + BRAG_LAG_MILLIS, roundMillis), botId, brag(paying), null));
            }
            case MARK -> {
                // The losing side, early, heavy, and never closed. On a shock regime this is
                // the pre-shock direction, so MARK is up big and loud right up to the moment
                // the shock erases it — which is the whole point of having a MARK.
                long at = jitter((long) (roundMillis * MARK_ENTRY), roundMillis, random);
                actions.add(new BotAction.Open(at, botId, paying.opposite(), 0.90, 7));
                actions.add(new BotAction.Say(
                        clamp(at + BRAG_LAG_MILLIS, roundMillis), botId,
                        brag(paying.opposite()), null));
            }
            case CHOPPER -> {
                long firstIn = jitter((long) (roundMillis * CHOPPER_FIRST_ENTRY), roundMillis, random);
                long firstOut = jitter((long) (roundMillis * CHOPPER_FIRST_EXIT), roundMillis, random);
                long secondIn = jitter((long) (roundMillis * CHOPPER_SECOND_ENTRY), roundMillis, random);
                long secondOut = jitter((long) (roundMillis * CHOPPER_SECOND_EXIT), roundMillis, random);

                actions.add(new BotAction.Open(firstIn, botId, paying, 0.35, 2));
                actions.add(new BotAction.Close(firstOut, botId));
                actions.add(new BotAction.Open(secondIn, botId, paying.opposite(), 0.35, 2));
                actions.add(new BotAction.Close(secondOut, botId));
            }
        }
        return actions;
    }

    /**
     * When SHARP gets in.
     *
     * On a shock regime, not until the shock is actually under way. RUG drifts up 20% before
     * collapsing and SQUEEZE drifts down before ripping: a correctly-positioned bot that
     * entered at the open would be liquidated by the drift long before the move it called.
     */
    private long sharpEntry(Regime regime, long roundMillis, Random random) {
        Regime.Shock shock = regime.shock();
        if (shock == null) {
            return jitter((long) (roundMillis * SHARP_ENTRY), roundMillis, random);
        }
        long shockStart = (long) (roundMillis * shock.startFraction());
        return clamp(shockStart + SHARP_SHOCK_LAG_MILLIS, roundMillis);
    }

    /**
     * The side this regime pays if you hold to the bell.
     *
     * A shock dominates the drift that precedes it — RUG drifts up 20% and then loses 40% —
     * so a shock regime pays the shock's direction, not its drift's.
     */
    private Side payingSide(Regime regime, Random random) {
        Regime.Shock shock = regime.shock();
        if (shock != null) {
            return shock.magnitude() > 0 ? Side.LONG : Side.SHORT;
        }
        if (regime.drift() > 0) {
            return Side.LONG;
        }
        if (regime.drift() < 0) {
            return Side.SHORT;
        }
        // CHOP has no drift at all, so neither side is favoured and a coin flip is honest.
        return random.nextBoolean() ? Side.LONG : Side.SHORT;
    }

    private String brag(Side side) {
        return side == Side.LONG ? "i'm long" : "i'm short";
    }

    // --- talking -------------------------------------------------------------

    /**
     * What each bot tells the room its tip said, during the intermission.
     *
     * Exactly one bot lies every round. Which one is drawn here rather than tied to a
     * persona on purpose: if the liar were always the loser, the human could read the
     * standings instead of reading the room, and the whole information layer would collapse
     * into arithmetic.
     */
    private List<BotAction.Say> claimsFor(List<String> botIds, Map<String, Rumor> rumors,
            long intermissionMillis, Random random) {
        int liar = random.nextInt(botIds.size());
        List<BotAction.Say> chatter = new ArrayList<>(botIds.size());

        for (int i = 0; i < botIds.size(); i++) {
            String botId = botIds.get(i);
            Rumor held = rumors.get(botId);
            // A bot with no tip has nothing to be honest or dishonest about. Cannot happen
            // through RoundPlanner, which deals one per seat, but a missing tip must not be
            // a crash inside the tick loop.
            if (held == null) {
                continue;
            }

            Regime claim = i == liar
                    ? otherThan(held.claimedRegime(), random)
                    : held.claimedRegime();

            long at = (long) (intermissionMillis * CLAIM_SLOTS[i % CLAIM_SLOTS.length]);
            chatter.add(new BotAction.Say(at, botId, "my tip says " + claim, claim));
        }

        chatter.sort(Comparator.comparingLong(BotAction::atMillis));
        return chatter;
    }

    private Regime otherThan(Regime regime, Random random) {
        Regime[] all = Regime.values();
        Regime picked;
        do {
            picked = all[random.nextInt(all.length)];
        } while (picked == regime);
        return picked;
    }

    // --- timing --------------------------------------------------------------

    private long jitter(long at, long roundMillis, Random random) {
        return clamp(at + random.nextLong(-JITTER_MILLIS, JITTER_MILLIS + 1), roundMillis);
    }

    /** Never before the bell and never after it — an action outside its phase never fires. */
    private long clamp(long at, long phaseMillis) {
        return Math.max(0, Math.min(at, phaseMillis - 1));
    }
}
