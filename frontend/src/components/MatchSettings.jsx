import { CASH_STEPS, LIMITS, PRESETS, estimateMinutes, matchingPreset } from "../lib/matchSettings";
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

  return (
    <div className="stack" style={{ gap: "0.6rem" }}>
      <div className="preset-row">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`btn preset ${active?.id === preset.id ? "btn-scream" : ""}`}
            onClick={() => set({ rounds: preset.rounds, roundSeconds: preset.roundSeconds })}
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

      <button type="button" className="link-btn muted" onClick={onToggle} aria-expanded={open}>
        {open ? "Hide settings" : "Advanced settings"}
      </button>

      {open && (
        <div className="advanced stack">
          {dial("Rounds", "rounds", (v) => v)}
          {dial("Round length", "roundSeconds", (v) => `${v}s`)}
          {dial("Max players", "maxPlayers", (v) => v)}

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
              onChange={(e) => set({ startingCash: CASH_STEPS[Number(e.target.value)] })}
            />
            {/* Said plainly so nobody mistakes this for a difficulty dial. */}
            <span className="setting-note muted">
              Cosmetic — scores are a percentage, so this only changes the numbers on screen.
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
