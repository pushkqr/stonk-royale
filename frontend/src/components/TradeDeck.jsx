import { memo, useState } from "react";
import { money, price as fmtPrice } from "../lib/format";
import LivePnl from "./LivePnl";
import FillEstimate from "./FillEstimate";

const PRESETS = [
  { label: "Safe", lev: 2, sz: 25 },
  { label: "Standard", lev: 4, sz: 50 },
  { label: "YOLO", lev: 10, sz: 100 },
];

/**
 * Four controls, and no more. Direction, leverage, size, and the nerve to close — those
 * are the decisions the game is about, so an order type or a limit price would only get
 * in their way.
 *
 * Memoised because it hangs off the trading screen, which re-renders on every price tick,
 * while everything shown here moves with the board instead — five times slower.
 */
function TradeDeck({ me, onOpen, onClose, disabled, impact }) {
  const [leverage, setLeverage] = useState(3);
  const [size, setSize] = useState(50);
  const [pending, setPending] = useState(false);

  const position = me?.position;
  const [prevPosition, setPrevPosition] = useState(position);

  if (position !== prevPosition) {
    setPrevPosition(position);
    setPending(false);
  }

  const handleOpen = (side) => {
    setPending(true);
    onOpen(side, size / 100, leverage);
  };

  const handleClose = () => {
    setPending(true);
    onClose();
  };

  if (position) {
    return (
      <div className="deck deck-open">
        <div className="deck-open-header">
          <div className="deck-open-info">
            <span className="eyebrow">Your position</span>
            <span className="display deck-open-side">
              <span className={position.side === "LONG" ? "pump" : "dump"}>
                {position.leverage}x {position.side}
              </span>
            </span>
            <span className="mono muted">
              in at {fmtPrice(position.entryPrice)} · liquidated at {fmtPrice(position.liquidationPrice)}
            </span>
          </div>

          <div className="deck-open-pnl">
            <span className="eyebrow">Unrealised</span>
            <LivePnl position={position} />
          </div>
        </div>

        <button
          className="btn btn-big btn-scream deck-close"
          onClick={handleClose}
          disabled={disabled || pending}
        >
          {pending ? "Closing…" : "Close Position"}
        </button>
      </div>
    );
  }

  const margin = ((me?.cash ?? me?.equity ?? 0) * size) / 100;
  const notional = margin * leverage;
  const liqMovePct = (0.9 / leverage) * 100;
  const maxLoss = margin * 0.9;

  let riskTier = "Low Risk";
  let riskClass = "risk-safe";
  if (leverage >= 6) {
    riskTier = "High Risk / Scalp";
    riskClass = "risk-high";
  } else if (leverage >= 3) {
    riskTier = "Moderate Risk";
    riskClass = "risk-mod";
  }

  return (
    <div className="deck">
      <div className="deck-presets">
        <span className="eyebrow">Presets</span>
        <div className="deck-preset-row">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`preset-btn ${leverage === p.lev && size === p.sz ? "is-active" : ""}`}
              onClick={() => {
                setLeverage(p.lev);
                setSize(p.sz);
              }}
              disabled={disabled}
            >
              {p.label} <span className="preset-meta">{p.lev}x · {p.sz}%</span>
            </button>
          ))}
        </div>
      </div>

      <div className="deck-dials">
        <label className="dial">
          <span className="eyebrow">
            Leverage <b className="mono scream">{leverage}x</b>
          </span>
          <input
            type="range"
            min="1"
            max="10"
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            disabled={disabled}
          />
        </label>

        <label className="dial">
          <span className="eyebrow">
            Size <b className="mono scream">{money(margin)}</b>
          </span>
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            disabled={disabled}
          />
        </label>
      </div>

      <div className="deck-preview">
        <span className="deck-preview-text mono">
          Liq at <strong>±{liqMovePct.toFixed(0)}%</strong> · Max loss <strong>{money(maxLoss)}</strong>
        </span>
        <span className={`risk-tag ${riskClass}`}>{riskTier}</span>
      </div>

      <div className="deck-sides">
        <button
          className="btn btn-big btn-pump"
          onClick={() => handleOpen("LONG")}
          disabled={disabled || pending}
        >
          {pending ? "Filling…" : "Long"}
          <FillEstimate side="LONG" notional={notional} impact={impact} />
        </button>
        <button
          className="btn btn-big btn-dump"
          onClick={() => handleOpen("SHORT")}
          disabled={disabled || pending}
        >
          {pending ? "Filling…" : "Short"}
          <FillEstimate side="SHORT" notional={notional} impact={impact} />
        </button>
      </div>
    </div>
  );
}

export default memo(TradeDeck);
