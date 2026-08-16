import { Crown, Skull, Drama, Gem, Flame, ShieldCheck } from "lucide-react";
import { pct } from "./format";

/**
 * Computes post-match accolades for the results screen.
 *
 * @param {Array} standings List of standing rows [{ playerId, nickname, totalScore, bestRound, bot }]
 * @param {Object} settled Final round settled object { regime, results: [{ playerId, nickname, roundScore, totalScore, liquidations, rumorClaimed, tipClaim }] }
 * @param {Array} feed Feed events history
 * @returns {Array} List of accolade objects [{ id, title, icon, player, subtitle }]
 */
export function computeAccolades(standings = [], settled = null, feed = []) {
  if (!standings || standings.length === 0) return [];

  const accolades = [];
  const results = settled?.results ?? [];

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

  // 2. The Rekt: Most liquidations in final round or across match feed
  const liquidationCounts = {};
  feed
    .filter((f) => f.kind === "LIQUIDATION")
    .forEach((f) => {
      liquidationCounts[f.playerId] = (liquidationCounts[f.playerId] || 0) + 1;
    });

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

  // 3. The Mastermind: Caught or successful liar
  const liar = results.find((r) => r.tipClaim && r.tipClaim !== r.rumorClaimed);
  if (liar) {
    accolades.push({
      id: "mastermind",
      title: "THE MASTERMIND",
      icon: Drama,
      player: liar.nickname,
      subtitle: `Claimed ${liar.tipClaim}, held ${liar.rumorClaimed}`,
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
