/**
 * Regime copy shared by the intermission and the mid-round dossier.
 *
 * It lives here rather than in either component because both screens name the same five
 * regimes, and copy duplicated across two files is copy that drifts apart.
 */

/** What the round actually turned out to be, in the game's own voice. */
export const REGIME_VERDICT = {
  PUMP: "It went up. Straight up.",
  DUMP: "It bled out.",
  CHOP: "It went nowhere, violently.",
  RUG: "It was a rug pull.",
  SQUEEZE: "The shorts got squeezed.",
};

/**
 * What a regime does to a chart, in as few words as fit a 14rem column. Shown beside a
 * tip's claim so reading it is one step instead of three.
 */
export const REGIME_PRIMER = {
  PUMP: "goes up steadily",
  DUMP: "goes down steadily",
  CHOP: "jumps around, ends flat",
  RUG: "creeps up, then crashes",
  SQUEEZE: "drifts down, then rockets",
};

/**
 * Actionable trading bias prescribed by a rumor claim.
 */
export const REGIME_BIAS = {
  PUMP: { label: "BET IT GOES UP", tone: "pump", desc: "Long on dips" },
  DUMP: { label: "BET IT GOES DOWN", tone: "dump", desc: "Short on pops" },
  CHOP: { label: "GET IN AND OUT FAST", tone: "muted", desc: "Quick in and out" },
  RUG: { label: "IT RISES, THEN CRASHES", tone: "dump", desc: "Pumps then collapses" },
  SQUEEZE: { label: "IT FALLS, THEN ROCKETS", tone: "pump", desc: "Bleeds then violent rip" },
};

/**
 * The one fact everybody shares. It makes the wire checkable: if four people claim a pump
 * and only one tip is true, three of them are lying where you can see it. Never zero — the
 * server guarantees a round holds at least one real tip.
 */
export function tipCountLine(count) {
  if (count === 1) return "One of you got the truth.";
  return `${count} of you got the truth.`;
}

/**
 * Identifies the market regime implied by a news headline.
 */
export function classifyHeadline(text) {
  if (!text) return null;
  const upper = text.toUpperCase();
  if (upper.includes("NAMED TOP PICK") || upper.includes("INSTITUTIONAL INFLOWS")) return "PUMP";
  if (upper.includes("DOWNGRADED") || upper.includes("EARLY BACKERS SEEN EXITING")) return "DUMP";
  if (upper.includes("VOLUME DRIES UP") || upper.includes("ANALYSTS SPLIT")) return "CHOP";
  if (upper.includes("DEV WALLET MOVING") || upper.includes("REGULATORS OPEN PROBE")) return "RUG";
  if (upper.includes("SHORT INTEREST HITS") || upper.includes("FLOAT LOCKED UP")) return "SQUEEZE";
  return null;
}

/**
 * Evaluates live breaking headlines against a player's secret tip claim.
 * @param {string} claimedRegime The regime claimed by player's rumor
 * @param {Array} headlines Array of string headline texts received this round
 * @returns {Object|null} Cross check status { status, text, tone, icon }
 */
export function evaluateCrossCheck(claimedRegime, headlines = []) {
  if (!claimedRegime || !headlines || headlines.length === 0) return null;

  const classified = headlines.map(classifyHeadline).filter(Boolean);
  if (classified.length === 0) return null;

  const matches = classified.filter((r) => r === claimedRegime).length;
  const conflicts = classified.filter((r) => r !== claimedRegime).length;

  if (classified.length === 1) {
    if (matches === 1) {
      return {
        status: "MATCHING",
        tone: "pump",
        icon: "🟢",
        text: "The news backs up your tip.",
      };
    }
    return {
      status: "CONFLICTING",
      tone: "dump",
      icon: "⚠️",
      text: `The news points to ${classified[0]} — your tip says otherwise.`,
    };
  }

  // Two or more headlines. A round drops exactly one true headline and one false one.
  if (matches > 0 && conflicts > 0) {
    const conflictingRegime = classified.find((r) => r !== claimedRegime);
    return {
      status: "MIXED",
      tone: "scream",
      icon: "⚖️",
      text: `One headline backs your tip, one points to ${conflictingRegime}. One of them is fake.`,
    };
  }

  // Both headlines read the same way, which cannot mean confirmation: one of the two is
  // always the round's planted lie, so this pattern means one was misread, not that the
  // tip is proven. It previously sent people in with full
  // conviction on rounds where the tip was false.
  if (matches >= 2) {
    return {
      status: "ALIGNED",
      tone: "scream",
      icon: "🎯",
      text: "Both headlines back your tip — but one headline is always fake.",
    };
  }

  return {
    status: "EXPOSED",
    tone: "dump",
    icon: "🚨",
    text: `Both headlines point away from ${claimedRegime}. Your tip looks fake.`,
  };
}

/**
 * Categorizes a player's round performance relative to the truthfulness of their rumor.
 *
 * The summaries say what the screen around them does not. What the market did is the
 * headline above this card and whether the tip was real is stamped across the card beside
 * it, so a summary that named either was spending its one sentence repeating something the
 * player had already read twice. It takes no regime argument for that reason: every branch
 * is about what the player did with the tip, which the result alone determines.
 */
export function deductionVerdict(myResult) {
  if (!myResult) return null;
  const { rumorWasTrue, roundScore, rumorClaimed } = myResult;
  const isPositive = (roundScore || 0) > 0;
  const isFlat = Math.abs(roundScore || 0) < 0.0001;

  if (isFlat) {
    return {
      tag: "RISK-OFF",
      tone: "muted",
      summary: "You never opened a position. Nothing won, nothing lost, nothing learned.",
    };
  }
  if (rumorWasTrue && isPositive) {
    return {
      tag: "INSIDER ALPHA",
      tone: "pump",
      summary: "You trusted real insider alpha and rode the wave to profit.",
    };
  }
  if (!rumorWasTrue && !isPositive) {
    return {
      tag: "BAMBOOZLED",
      tone: "dump",
      summary: `You fell for the fake ${rumorClaimed || "market"} leak. Disinformation won.`,
    };
  }
  if (!rumorWasTrue && isPositive) {
    return {
      tag: "BIG BRAIN CONTRARIAN",
      tone: "pump",
      summary: "You sniffed out the fake tip and traded against the herd!",
    };
  }
  // Everything above has returned by now, so this is the one remaining case: a real tip that
  // still lost money. Worth naming as its own thing rather than as a fallback — it is the
  // outcome that teaches the most, and the one players are quickest to blame the tip for.
  return {
    tag: "WRONG-FOOTED",
    tone: "dump",
    summary: "Your tip was real and you finished down anyway. Knowing the shape is not the same as timing it.",
  };
}
