/**
 * Host-configurable match settings.
 *
 * The bounds here mirror MatchConfig on the server, which is the real guard — these exist
 * so the controls can't produce a value the server would reject, not to enforce anything.
 */
export const DEFAULTS = {
  rounds: 5,
  roundSeconds: 90,
  intermissionSeconds: 25,
  maxPlayers: 12,
  startingCash: 10_000,
  isPublic: false,
  volatilityMultiplier: 1.0,
  marketImpactMultiplier: 1.0,
  modifier: "NONE",
};

/**
 * The rule variants a host can pick, for the picker only.
 *
 * Modifier.java is the source of truth and sends its own label and blurb down with the lobby,
 * which is what the lobby, the briefing and the trading floor render. This list exists because
 * the picker has to describe variants that are not active yet, and nothing has been sent for
 * those. Keep the wording here in step with the enum; if the two drift, the picker is wrong
 * and the game is still right.
 */
export const MODIFIER_OPTIONS = [
  { value: "NONE", label: "Standard", blurb: "The normal game." },
  {
    value: "ALL_LIES",
    label: "All Lies",
    blurb: "Every tip in the room is false. The truth is what is left over.",
  },
  {
    value: "HIGH_ROLLER",
    label: "High Roller",
    blurb: "Nothing under 5x. Somebody is getting liquidated.",
  },
];

/** The floor a variant puts under every position, which the deck has to respect. */
export const MIN_LEVERAGE_FOR = { HIGH_ROLLER: 5 };
export const minLeverageFor = (modifier) => MIN_LEVERAGE_FOR[modifier] ?? 1;

export const LIMITS = {
  rounds: { min: 1, max: 8, step: 1 },
  roundSeconds: { min: 10, max: 180, step: 10 },
  intermissionSeconds: { min: 5, max: 60, step: 5 },
  maxPlayers: { min: 2, max: 12, step: 1 },
};

/** Cosmetic, so a short list of round numbers beats a free-text field. */
export const CASH_STEPS = [1_000, 10_000, 100_000, 1_000_000];

export const VOLATILITY_OPTIONS = [
  { value: 0.7, label: "Calm (0.7x)" },
  { value: 1.0, label: "Standard (1.0x)" },
  { value: 1.4, label: "Wild (1.4x)" },
  { value: 1.8, label: "Chaos (1.8x)" },
];

export const MARKET_IMPACT_OPTIONS = [
  { value: 1.0, label: "Standard (1.0x)" },
  { value: 2.0, label: "Heavy (2.0x)" },
  { value: 3.5, label: "Whale Wars (3.5x)" },
  { value: 5.0, label: "Chaos (5.0x)" },
];

export const PRESETS = [
  {
    id: "blitz",
    label: "Blitz",
    rounds: 3,
    roundSeconds: 30,
    intermissionSeconds: 15,
    volatilityMultiplier: 1.4,
    marketImpactMultiplier: 1.0,
  },
  {
    id: "standard",
    label: "Standard",
    rounds: 5,
    roundSeconds: 90,
    intermissionSeconds: 25,
    volatilityMultiplier: 1.0,
    marketImpactMultiplier: 1.0,
  },
  {
    id: "marathon",
    label: "Marathon",
    rounds: 7,
    roundSeconds: 120,
    intermissionSeconds: 30,
    volatilityMultiplier: 0.8,
    marketImpactMultiplier: 1.0,
  },
  {
    id: "whale_wars",
    label: "Whale Wars",
    rounds: 4,
    roundSeconds: 60,
    intermissionSeconds: 20,
    volatilityMultiplier: 1.4,
    marketImpactMultiplier: 3.5,
  },
];

export function estimateMinutes({ rounds, roundSeconds, intermissionSeconds }) {
  return Math.max(1, Math.round((rounds * (roundSeconds + intermissionSeconds)) / 60));
}

export function matchingPreset({ rounds, roundSeconds, marketImpactMultiplier }) {
  return (
    PRESETS.find(
      (p) =>
        p.rounds === rounds &&
        p.roundSeconds === roundSeconds &&
        (marketImpactMultiplier == null ||
          Math.abs((p.marketImpactMultiplier ?? 1.0) - (marketImpactMultiplier ?? 1.0)) < 0.2)
    ) ?? null
  );
}
