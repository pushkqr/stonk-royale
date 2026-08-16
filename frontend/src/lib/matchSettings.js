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
};

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
  { value: 2.5, label: "Heavy (2.5x)" },
  { value: 4.0, label: "Whale Wars (4.0x)" },
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
    label: "⚔️ Whale Wars",
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
