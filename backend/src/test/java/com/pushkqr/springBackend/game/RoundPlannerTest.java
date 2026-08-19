package com.pushkqr.springBackend.game;

import com.pushkqr.springBackend.game.model.MatchConfig;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The tip count is the one number the whole room is told, so what it is allowed to be is the
 * mechanic. These assertions are about the ends it must never reach.
 */
class RoundPlannerTest {

    private static final MatchConfig CONFIG = new MatchConfig(3, 30, 10, 10_000, 12);

    /**
     * One stream shared across a test's iterations, never a fresh Random per iteration.
     * A {@code java.util.Random} seeded with small sequential values returns the same first
     * draw every time — {@code new Random(s).nextInt(2)} is 1 for every s from 0 to 199 — so
     * re-seeding inside the loop would quietly exercise a single branch of the range and the
     * assertions below would prove far less than they appear to.
     */
    private final Random random = new Random(20260819L);

    private static List<String> seats(int count) {
        List<String> ids = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            ids.add("p" + i);
        }
        return ids;
    }

    @Test
    void neverTellsTheRoomThatNobodyOrEverybodyHoldsARealTip() {
        // The two answers that end the round before it starts: "none of you" leaves nothing to
        // check a claim against, and "all of you" means nobody has to lie.
        for (int players = 2; players <= 12; players++) {
            for (int i = 0; i < 500; i++) {
                int count = RoundPlanner.truthfulTipCount(players, random);
                assertThat(count)
                        .as("players=%d iteration=%d", players, i)
                        .isGreaterThanOrEqualTo(1)
                        .isLessThanOrEqualTo(players - 1);
            }
        }
    }

    @Test
    void neverDealsALoneTrueTipOnceThereAreFourSeats() {
        // One real tip in four or more is the same as none: everybody correctly assumes theirs
        // is the lie, so nobody has anything to weigh. Below four seats there is no room for a
        // value that is neither of the ends, which is why this starts at four.
        for (int players = 4; players <= 12; players++) {
            for (int i = 0; i < 500; i++) {
                assertThat(RoundPlanner.truthfulTipCount(players, random))
                        .as("players=%d iteration=%d", players, i)
                        .isGreaterThanOrEqualTo(2);
            }
        }
    }

    @Test
    void staysWithinAbandAroundHalfTheRoom() {
        for (int players = 2; players <= 12; players++) {
            for (int i = 0; i < 200; i++) {
                double share = RoundPlanner.truthfulTipCount(players, random)
                        / (double) players;
                assertThat(share)
                        .as("players=%d iteration=%d", players, i)
                        .isBetween(0.33, 0.67);
            }
        }
    }

    @Test
    void stillMovesFromRoundToRound() {
        // Narrow is the point; constant is not. A number that never changes stops being worth
        // announcing, and the room would learn to ignore it.
        for (int players = 5; players <= 12; players++) {
            Set<Integer> seen = new HashSet<>();
            for (int i = 0; i < 200; i++) {
                seen.add(RoundPlanner.truthfulTipCount(players, random));
            }
            assertThat(seen).as("players=%d", players).hasSizeGreaterThan(1);
        }
    }

    @Test
    void twoSeatsCollapseToExactlyOne() {
        for (int i = 0; i < 200; i++) {
            assertThat(RoundPlanner.truthfulTipCount(2, random)).isEqualTo(1);
        }
    }

    @Test
    void theAnnouncedCountMatchesTheTipsActuallyDealt() {
        // The count is public while the tips stay private, so the two agreeing is the whole
        // contract. Worth re-checking at this size because who holds truth is now chosen by
        // shuffling the roster rather than drawn seat by seat.
        RoundPlanner planner = new RoundPlanner();
        for (int i = 0; i < 200; i++) {
            List<String> ids = seats(8);
            RoundPlan plan = planner.plan(i, 0, ids, List.of(), CONFIG);

            long dealt = ids.stream().filter(id -> plan.rumorFor(id).truthful()).count();
            assertThat(dealt).as("seed=%d", i).isEqualTo(plan.truthfulTipCount());
        }
    }

    @Test
    void theSameSeedDealsTheSameTipsToTheSamePeople() {
        // Rematch-on-the-same-market rests on this, and the shuffle that picks who holds truth
        // draws from the same Random as everything else — so it has to stay reproducible.
        RoundPlanner planner = new RoundPlanner();
        List<String> ids = seats(6);

        for (int i = 0; i < 50; i++) {
            RoundPlan first = planner.plan(i, 1, ids, List.of(), CONFIG);
            RoundPlan second = planner.plan(i, 1, ids, List.of(), CONFIG);

            for (String id : ids) {
                assertThat(second.rumorFor(id).truthful())
                        .as("seed=%d seat=%s", i, id)
                        .isEqualTo(first.rumorFor(id).truthful());
                assertThat(second.rumorFor(id).text()).isEqualTo(first.rumorFor(id).text());
            }
        }
    }
}
