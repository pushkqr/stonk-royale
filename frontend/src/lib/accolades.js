import { Crown, Skull, Drama, Gem, Flame, ShieldCheck } from "lucide-react";
import { pct } from "./format";

/**
 * Computes post-match accolades for the results screen.
 *
 * @param {Array} standings List of standing rows [{ playerId, nickname, totalScore, bestRound, bot }]
 * @param {Object} settled Final round settled object { regime, results: [{ playerId, nickname, roundScore, totalScore, liquidations, rumorClaimed, tipClaim }] }
 * @param {Array} feed Feed events history
 * @param {Object} matchLiquidations Match liquidations count map
 * @param {Array} roundHistory List of all settled round objects across the match
 * @returns {Array} List of accolade objects [{ id, title, icon, player, subtitle }]
 */
export function computeAccolades(standings = [], settled = null, feed = [],
    matchLiquidations = {}, roundHistory = []) {
  if (!standings || standings.length === 0) return [];

  const accolades = [];

  // 1. The Oracle: Highest best single round
  const bestRoundPlayer = [...standings].sort((a, b) => (b.bestRound ?? 0) - (a.bestRound ?? 0))[0];
  if (bestRoundPlayer && (bestRoundPlayer.bestRound ?? 0) > 0) {
    accolades.push({
      id: "oracle",
      title: "THE ORACLE",
      icon: Crown,
      player: bestRoundPlayer.nickname,
      subtitle: `${pct(bestRoundPlayer.bestRound)} best single round`,
    });
  }

  // 2. The Rekt: Most liquidations across the match
  const liquidationCounts = { ...matchLiquidations };
  // Fallback to feed if matchLiquidations is empty (e.g. tests or direct calls)
  if (Object.keys(liquidationCounts).length === 0 && feed) {
    feed
      .filter((f) => f.kind === "LIQUIDATION" && f.playerId)
      .forEach((f) => {
        liquidationCounts[f.playerId] = (liquidationCounts[f.playerId] || 0) + 1;
      });
  }

  let mostRektId = null;
  let maxLiqs = 0;
  for (const [pId, count] of Object.entries(liquidationCounts)) {
    if (count > maxLiqs) {
      maxLiqs = count;
      mostRektId = pId;
    }
  }

  if (mostRektId && maxLiqs > 0) {
    const rektPlayer = standings.find((p) => p.playerId === mostRektId);
    if (rektPlayer) {
      accolades.push({
        id: "rekt",
        title: "THE REKT",
        icon: Skull,
        player: rektPlayer.nickname,
        subtitle: `${maxLiqs} liquidation${maxLiqs > 1 ? "s" : ""} suffered`,
      });
    }
  }

  /**
   * 3. The Mastermind: the most persistent liar of the match.
   *
   * This used to read the final round only, and to take the first liar in array order —
   * so a player who lied in every round but the last was invisible, and when several
   * people lied in the last round the award went to whoever happened to sort first.
   * Falls back to the single settled round when no history was passed, which is what
   * keeps the older call shape working.
   */
  const rounds = roundHistory.length > 0 ? roundHistory : (settled ? [settled] : []);
  const liars = new Map();
  for (const round of rounds) {
    for (const r of round.results ?? []) {
      if (r.tipClaim && r.tipClaim !== r.rumorClaimed) {
        const seen = liars.get(r.playerId) ?? { count: 0, nickname: r.nickname, last: r };
        liars.set(r.playerId, { count: seen.count + 1, nickname: r.nickname, last: r });
      }
    }
  }

  const totalOf = (playerId) =>
    standings.find((p) => p.playerId === playerId)?.totalScore ?? 0;

  const topLiar = [...liars.entries()].sort(
    (a, b) => b[1].count - a[1].count || totalOf(b[0]) - totalOf(a[0]),
  )[0]?.[1];

  if (topLiar) {
    accolades.push({
      id: "mastermind",
      title: "THE MASTERMIND",
      icon: Drama,
      player: topLiar.nickname,
      subtitle: rounds.length > 1
        ? `Lied in ${topLiar.count} of ${rounds.length} rounds`
        : `Claimed ${topLiar.last.tipClaim}, held ${topLiar.last.rumorClaimed}`,
    });
  }

  // 4. The Survivor: Player with 0 liquidations and positive profit
  const survivor = standings.find(
    (p) => !liquidationCounts[p.playerId] && (p.totalScore ?? 0) > 0
  );
  if (survivor && accolades.length < 4) {
    accolades.push({
      id: "survivor",
      title: "THE SURVIVOR",
      icon: ShieldCheck,
      player: survivor.nickname,
      subtitle: `Clean sheet & ${pct(survivor.totalScore)} profit`,
    });
  }

  // 5. The Degen: Player with most trade actions in feed
  const tradeCounts = {};
  feed
    .filter((f) => f.kind === "TRADE" || f.kind === "LEVERAGE")
    .forEach((f) => {
      tradeCounts[f.playerId] = (tradeCounts[f.playerId] || 0) + 1;
    });

  let degenId = null;
  let maxTrades = 0;
  for (const [pId, count] of Object.entries(tradeCounts)) {
    if (count > maxTrades) {
      maxTrades = count;
      degenId = pId;
    }
  }

  if (degenId && maxTrades > 0 && accolades.length < 4) {
    const degenPlayer = standings.find((p) => p.playerId === degenId);
    if (degenPlayer) {
      accolades.push({
        id: "degen",
        title: "THE DEGEN",
        icon: Flame,
        player: degenPlayer.nickname,
        subtitle: `${maxTrades} market trades placed`,
      });
    }
  }

  // 6. Diamond Hands: Highest total score among non-winners or winner with positive returns
  if (accolades.length < 4 && standings.length > 1) {
    const runnerUp = standings[1];
    if (runnerUp && (runnerUp.totalScore ?? 0) > 0) {
      accolades.push({
        id: "diamond",
        title: "DIAMOND HANDS",
        icon: Gem,
        player: runnerUp.nickname,
        subtitle: `${pct(runnerUp.totalScore)} total profit`,
      });
    }
  }

  return accolades.slice(0, 4);
}
