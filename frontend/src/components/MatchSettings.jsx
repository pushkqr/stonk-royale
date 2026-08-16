import {
  CASH_STEPS,
  LIMITS,
  PRESETS,
  VOLATILITY_OPTIONS,
  MARKET_IMPACT_OPTIONS,
  estimateMinutes,
  matchingPreset,
} from "../lib/matchSettings";
import { money } from "../lib/format";

/**
 * Presets carry the common case — most hosts want "make it shorter", not a form — and the
 * individual dials sit behind a disclosure for the rest.
 */
export default function MatchSettings({ settings, onChange, open, onToggle }) {
  const active = matchingPreset(settings);
  const set = (patch) => onChange({ ...settings, ...patch });

  const dial = (label, key, format) => (
    <label className="setting">
      <span className="eyebrow setting-label">
        {label} <b className="mono scream">{format(settings[key])}</b>
      </span>
      <input
        type="range"
        min={LIMITS[key].min}
        max={LIMITS[key].max}
        step={LIMITS[key].step}
        value={settings[key]}
        onChange={(e) => set({ [key]: Number(e.target.value) })}
      />
    </label>
  );

  let volIndex = 1;
  let minVolDiff = Infinity;
  const currentVol = settings.volatilityMultiplier ?? 1.0;
  for (let i = 0; i < VOLATILITY_OPTIONS.length; i += 1) {
    const diff = Math.abs(VOLATILITY_OPTIONS[i].value - currentVol);
    if (diff < minVolDiff) {
      minVolDiff = diff;
      volIndex = i;
    }
  }

  let impactIndex = 0;
  let minImpactDiff = Infinity;
  const currentImpact = settings.marketImpactMultiplier ?? 1.0;
  for (let i = 0; i < MARKET_IMPACT_OPTIONS.length; i += 1) {
    const diff = Math.abs(MARKET_IMPACT_OPTIONS[i].value - currentImpact);
    if (diff < minImpactDiff) {
      minImpactDiff = diff;
      impactIndex = i;
    }
  }

  return (
    <div className="stack" style={{ gap: "0.6rem" }}>
      <div className="preset-row">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`btn preset preset-${preset.id} ${
              active?.id === preset.id ? "btn-scream" : ""
            }`}
            onClick={() =>
              set({
                rounds: preset.rounds,
                roundSeconds: preset.roundSeconds,
                intermissionSeconds: preset.intermissionSeconds,
                volatilityMultiplier: preset.volatilityMultiplier,
                marketImpactMultiplier: preset.marketImpactMultiplier,
              })
            }
            aria-pressed={active?.id === preset.id}
          >
            {preset.label}
            <span className="preset-sub mono">
              {preset.rounds}×{preset.roundSeconds}s
            </span>
          </button>
        ))}
      </div>

      <p className="estimate mono">
        About {estimateMinutes(settings)} minutes
        {!active && " · custom"}
      </p>

      <button
        type="button"
        className="link-btn muted"
        onClick={onToggle}
        aria-expanded={open}
      >
        {open ? "Hide settings" : "Advanced settings"}
      </button>

      {open && (
        <div className="advanced stack">
          {dial("Rounds", "rounds", (v) => v)}
          {dial("Round length", "roundSeconds", (v) => `${v}s`)}
          {dial("Talk between rounds", "intermissionSeconds", (v) => `${v}s`)}
          {dial("Max players", "maxPlayers", (v) => v)}

          <label className="setting">
            <span className="eyebrow setting-label">
              Market Volatility{" "}
              <b className="mono scream">
                {VOLATILITY_OPTIONS[volIndex >= 0 ? volIndex : 1].label}
              </b>
            </span>
            <input
              type="range"
              min="0"
              max={VOLATILITY_OPTIONS.length - 1}
              step="1"
              value={volIndex >= 0 ? volIndex : 1}
              onChange={(e) =>
                set({
                  volatilityMultiplier:
                    VOLATILITY_OPTIONS[Number(e.target.value)].value,
                })
              }
            />
            <span className="setting-note muted">
              Controls chart turbulence, wick sharpness, and swing speed.
            </span>
          </label>

          <label className="setting">
            <span className="eyebrow setting-label">
              Market Impact{" "}
              <b className="mono scream">
                {MARKET_IMPACT_OPTIONS[impactIndex >= 0 ? impactIndex : 0].label}
              </b>
            </span>
            <input
              type="range"
              min="0"
              max={MARKET_IMPACT_OPTIONS.length - 1}
              step="1"
              value={impactIndex >= 0 ? impactIndex : 0}
              onChange={(e) =>
                set({
                  marketImpactMultiplier:
                    MARKET_IMPACT_OPTIONS[Number(e.target.value)].value,
                })
              }
            />
            <span className="setting-note muted">
              How hard player orders push the market tape (Whale Wars PvP).
            </span>
          </label>

          <label className="setting">
            <span className="eyebrow setting-label">
              Starting cash <b className="mono scream">{money(settings.startingCash)}</b>
            </span>
            <input
              type="range"
              min="0"
              max={CASH_STEPS.length - 1}
              step="1"
              value={Math.max(0, CASH_STEPS.indexOf(settings.startingCash))}
              onChange={(e) =>
                set({ startingCash: CASH_STEPS[Number(e.target.value)] })
              }
            />
            {/* Said plainly so nobody mistakes this for a difficulty dial. */}
            <span className="setting-note muted">
              Cosmetic — scores are a percentage, so this only changes the numbers on screen.
            </span>
          </label>

          <div className="setting">
            <label className="setting-check">
              <input
                type="checkbox"
                checked={settings.isPublic ?? false}
                onChange={(e) => set({ isPublic: e.target.checked })}
              />
              <span className="eyebrow">Let strangers find this room</span>
            </label>
            {/* What "public" costs, said before they tick it rather than after. */}
            <span className="setting-note muted">
              Anyone pressing “Find me a game” can land here. Off means the code or the link,
              and nothing else.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
