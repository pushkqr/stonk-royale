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
};

export const LIMITS = {
  rounds: { min: 1, max: 8, step: 1 },
  roundSeconds: { min: 10, max: 180, step: 10 },
  intermissionSeconds: { min: 5, max: 60, step: 5 },
  maxPlayers: { min: 2, max: 12, step: 1 },
};

/** Cosmetic, so a short list of round numbers beats a free-text field. */
export const CASH_STEPS = [1_000, 10_000, 100_000, 1_000_000];

export const PRESETS = [
  { id: "quick", label: "Quick", rounds: 3, roundSeconds: 60 },
  { id: "standard", label: "Standard", rounds: 5, roundSeconds: 90 },
  { id: "long", label: "Long", rounds: 7, roundSeconds: 90 },
];

export function estimateMinutes({ rounds, roundSeconds, intermissionSeconds }) {
  return Math.max(1, Math.round((rounds * (roundSeconds + intermissionSeconds)) / 60));
}

export function matchingPreset({ rounds, roundSeconds }) {
  return PRESETS.find((p) => p.rounds === rounds && p.roundSeconds === roundSeconds) ?? null;
}
