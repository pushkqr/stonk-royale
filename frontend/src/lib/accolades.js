import { Crown, Skull, Drama, Flame, ShieldCheck, Scale } from "lucide-react";
import { pct } from "./format";

/** Four fit the results grid, and a fifth would start naming people for nothing. */
const MAX_ACCOLADES = 4;

/** [id, n] pairs, biggest first, with anything at or below zero dropped. */
function rankedByCount(counts) {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

function countLiquidations(matchLiquidations, feed) {
  const counts = { ...matchLiquidations };
  // The feed is only a fallback: it is truncated in long matches, so the server's tally is
  // authoritative wherever it was passed.
  if (Object.keys(counts).length === 0 && feed) {
    feed
      .filter((f) => f.kind === "LIQUIDATION" && f.playerId)
      .forEach((f) => {
        counts[f.playerId] = (counts[f.playerId] || 0) + 1;
      });
  }
  return counts;
}

function countTrades(feed) {
  const counts = {};
  (feed ?? [])
    .filter((f) => (f.kind === "TRADE" || f.kind === "LEVERAGE") && f.playerId)
    .forEach((f) => {
      counts[f.playerId] = (counts[f.playerId] || 0) + 1;
    });
  return counts;
}

/** Per player: how many rounds they went on record, and how many of those were lies. */
function countClaims(rounds) {
  const claims = new Map();
  for (const round of rounds) {
    for (const r of round.results ?? []) {
      if (!r.tipClaim) continue;
      const seen = claims.get(r.playerId) ?? { told: 0, lied: 0, last: r };
      claims.set(r.playerId, {
        told: seen.told + 1,
        lied: seen.lied + (r.tipClaim !== r.rumorClaimed ? 1 : 0),
        last: r,
      });
    }
  }
  return claims;
}

/**
 * Computes post-match accolades for the results screen.
 *
 * Every award is a ranking rather than a single winner, and they are handed out one player
 * at a time. That is the whole design, and it exists because the previous version computed
 * six awards independently against the same standings and let them collide: in a four-human
 * match where nobody blew up, the winner took THE ORACLE, THE MASTERMIND and THE SURVIVOR
 * while half the table got nothing, and in the default solo-versus-bots shape a single bot
 * swept three of the four. A closing screen whose job is to give everyone a moment cannot
 * hand the same person three of them.
 *
 * The order below is the order they pick in, and it runs most-constrained first. THE REKT
 * fits almost nobody, so it chooses before THE ORACLE — which in practice means "the
 * winner" — can take its candidate away. THE SURVIVOR is last because it is the broadest
 * and makes the best filler.
 *
 * @param {Array} standings [{ playerId, nickname, totalScore, bestRound, bot }]
 * @param {Object} settled Final round { regime, results: [...] }
 * @param {Array} feed Feed events history
 * @param {Object} matchLiquidations Server tally of liquidations per player
 * @param {Array} roundHistory Every settled round of the match
 * @returns {Array} [{ id, title, icon, player, subtitle }]
 */
export function computeAccolades(standings = [], settled = null, feed = [],
    matchLiquidations = {}, roundHistory = []) {
  if (!standings || standings.length === 0) return [];

  const byId = new Map(standings.map((p) => [p.playerId, p]));
  const known = (ids) => ids.filter((id) => byId.has(id));
  const humans = (ids) => ids.filter((id) => !byId.get(id)?.bot);

  const liquidations = countLiquidations(matchLiquidations, feed);
  const rounds = roundHistory.length > 0 ? roundHistory : (settled ? [settled] : []);
  const claims = countClaims(rounds);

  // Spoke up across the match, never once misreported the tip.
  //
  // Silence needs no guard here: countClaims only records a player who actually went on
  // record, so someone who never spoke is absent from the map rather than sitting in it with
  // a spotless nothing. What the threshold buys is the next case along — one truthful claim
  // in a five-round match is not a record of honesty, it is one remark.
  const minimumToCount = Math.min(2, rounds.length);
  const straight = [...claims.entries()]
    .filter(([, c]) => c.lied === 0 && c.told >= minimumToCount)
    .sort((a, b) => b[1].told - a[1].told)
    .map(([id]) => id);

  const liars = [...claims.entries()]
    .filter(([, c]) => c.lied > 0)
    .sort((a, b) => b[1].lied - a[1].lied
      || (byId.get(b[0])?.totalScore ?? 0) - (byId.get(a[0])?.totalScore ?? 0))
    .map(([id]) => id);

  const candidates = [
    {
      id: "rekt",
      title: "THE REKT",
      icon: Skull,
      ranked: known(rankedByCount(liquidations)),
      subtitle: (id) => `${liquidations[id]} liquidation${liquidations[id] > 1 ? "s" : ""} suffered`,
    },
    {
      /*
       * Humans only, here and in THE STRAIGHT SHOOTER below. Both awards are about what a
       * player chose to say, and a bot's claim is not a choice — BotScripter picks one bot
       * per round to misreport its tip when it builds the script, before anybody has
       * played a second. Handing the prize for the match's best liar to a coin flip made
       * at generation time is the one way these awards can be actively deflating, which is
       * not true of the outcome-based ones: a bot really did take those liquidations.
       */
      id: "mastermind",
      title: "THE MASTERMIND",
      icon: Drama,
      ranked: humans(known(liars)),
      subtitle: (id) => {
        const c = claims.get(id);
        return rounds.length > 1
          ? `Lied in ${c.lied} of ${rounds.length} rounds`
          : `Claimed ${c.last.tipClaim}, held ${c.last.rumorClaimed}`;
      },
    },
    {
      id: "oracle",
      title: "THE ORACLE",
      icon: Crown,
      ranked: [...standings]
        .filter((p) => (p.bestRound ?? 0) > 0)
        .sort((a, b) => (b.bestRound ?? 0) - (a.bestRound ?? 0))
        .map((p) => p.playerId),
      subtitle: (id) => `${pct(byId.get(id).bestRound)} best single round`,
    },
    {
      /*
       * Replaces DIAMOND HANDS, which was `standings[1]` — second place wearing a name
       * about conviction, measuring nothing, and appearing only as filler when fewer than
       * four other awards had fired. This measures something the scoring deliberately never
       * pays for: talking all match and never once lying about the tip.
       */
      id: "straight",
      title: "THE STRAIGHT SHOOTER",
      icon: Scale,
      ranked: humans(known(straight)),
      subtitle: (id) => {
        const told = claims.get(id).told;
        return `On record ${told} time${told > 1 ? "s" : ""}, never lied`;
      },
    },
    {
      id: "degen",
      title: "THE DEGEN",
      icon: Flame,
      ranked: known(rankedByCount(countTrades(feed))),
      subtitle: (id) => `${countTrades(feed)[id]} market trades placed`,
    },
    {
      id: "survivor",
      title: "THE SURVIVOR",
      icon: ShieldCheck,
      ranked: [...standings]
        .filter((p) => !liquidations[p.playerId] && (p.totalScore ?? 0) > 0)
        .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
        .map((p) => p.playerId),
      subtitle: (id) => `Clean sheet & ${pct(byId.get(id).totalScore)} profit`,
    },
  ];

  const taken = new Set();
  const awarded = [];

  for (const candidate of candidates) {
    if (awarded.length === MAX_ACCOLADES) break;
    const winner = candidate.ranked.find((id) => !taken.has(id));
    if (!winner) continue;

    taken.add(winner);
    awarded.push({
      id: candidate.id,
      title: candidate.title,
      icon: candidate.icon,
      player: byId.get(winner).nickname,
      subtitle: candidate.subtitle(winner),
    });
  }

  return awarded;
}
