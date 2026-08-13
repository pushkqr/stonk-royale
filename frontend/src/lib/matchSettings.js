/**
 * Host-configurable match settings.
 *
 * The bounds here mirror MatchConfig on the server, which is the real guard — these exist
 * so the controls can't produce a value the server would reject, not to enforce anything.
 */
export const DEFAULTS = {
  rounds: 5,
  roundSeconds: 90,
  maxPlayers: 12,
  startingCash: 10_000,
};

export const LIMITS = {
  rounds: { min: 1, max: 8, step: 1 },
  roundSeconds: { min: 10, max: 180, step: 10 },
  maxPlayers: { min: 2, max: 12, step: 1 },
};

/** Cosmetic, so a short list of round numbers beats a free-text field. */
export const CASH_STEPS = [1_000, 10_000, 100_000, 1_000_000];

/**
 * Mirrors the server's intermission default. Only used to estimate match length before a
 * match exists, so there is nothing to read it from yet.
 */
const INTERMISSION_SECONDS = 15;

export const PRESETS = [
  { id: "quick", label: "Quick", rounds: 3, roundSeconds: 60 },
  { id: "standard", label: "Standard", rounds: 5, roundSeconds: 90 },
  { id: "long", label: "Long", rounds: 7, roundSeconds: 90 },
];

export function estimateMinutes({ rounds, roundSeconds }) {
  return Math.max(1, Math.round((rounds * (roundSeconds + INTERMISSION_SECONDS)) / 60));
}

export function matchingPreset({ rounds, roundSeconds }) {
  return PRESETS.find((p) => p.rounds === rounds && p.roundSeconds === roundSeconds) ?? null;
}
