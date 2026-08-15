import { memo, useCallback, useEffect, useState } from "react";
import { money, price as fmtPrice } from "../lib/format";
import LivePnl from "./LivePnl";
import FillEstimate from "./FillEstimate";
import { usePrice } from "../state/MatchProvider";

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
  const { tick } = usePrice();
  const [leverage, setLeverage] = useState(3);
  const [size, setSize] = useState(50);
  const [pending, setPending] = useState(false);
  const [optimisticPos, setOptimisticPos] = useState(null);
  const [prevPosition, setPrevPosition] = useState(me?.position);

  if (me?.position !== prevPosition) {
    setPrevPosition(me?.position);
    setOptimisticPos(null);
    setPending(false);
  }

  // Safety fallback: guarantee pending is never stuck for > 2000ms
  useEffect(() => {
    if (pending) {
      const timer = setTimeout(() => setPending(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [pending]);

  const position = optimisticPos || me?.position;

  const handleOpen = useCallback(
    (side) => {
      const livePrice = tick?.price || 1;
      const available = Math.max(0, me?.cash ?? me?.equity ?? 0);
      const margin = (available * size) / 100;
      const liqPrice = livePrice * (1 - ((side === "LONG" ? 1 : -1) * 0.90) / leverage);

      setOptimisticPos({
        side,
        margin,
        leverage,
        entryPrice: livePrice,
        liquidationPrice: liqPrice,
        unrealisedPnl: 0,
      });
      setPending(true);
      onOpen(side, size / 100, leverage);
    },
    [onOpen, size, leverage, tick?.price, me?.cash, me?.equity]
  );

  const handleClose = useCallback(() => {
    setOptimisticPos(null);
    setPending(true);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (disabled || pending) return;

    const handleKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) {
        return;
      }

      if (position) {
        if (e.key === " " || e.key === "Spacebar" || e.key.toLowerCase() === "c") {
          e.preventDefault();
          handleClose();
        }
      } else {
        if (e.key.toLowerCase() === "l" || e.key === "ArrowUp") {
          e.preventDefault();
          handleOpen("LONG");
        } else if (e.key.toLowerCase() === "s" || e.key === "ArrowDown") {
          e.preventDefault();
          handleOpen("SHORT");
        } else if (e.key === "1") {
          e.preventDefault();
          setLeverage(PRESETS[0].lev);
          setSize(PRESETS[0].sz);
        } else if (e.key === "2") {
          e.preventDefault();
          setLeverage(PRESETS[1].lev);
          setSize(PRESETS[1].sz);
        } else if (e.key === "3") {
          e.preventDefault();
          setLeverage(PRESETS[2].lev);
          setSize(PRESETS[2].sz);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, pending, position, handleClose, handleOpen]);

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
          {pending ? (
            "Closing…"
          ) : (
            <>
              Close Position <kbd className="keycap">Space</kbd>
            </>
          )}
        </button>
      </div>
    );
  }

  const availableCash = Math.max(0, me?.cash ?? me?.equity ?? 0);
  const margin = (availableCash * size) / 100;
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
          {PRESETS.map((p, idx) => (
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
              <kbd className="keycap">{idx + 1}</kbd> {p.label}{" "}
              <span className="preset-meta">
                {p.lev}x · {p.sz}%
              </span>
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
          disabled={disabled || pending || availableCash <= 0}
        >
          {pending ? (
            "Filling…"
          ) : (
            <>
              Long <kbd className="keycap">L</kbd>
            </>
          )}
          <FillEstimate side="LONG" notional={notional} impact={impact} />
        </button>
        <button
          className="btn btn-big btn-dump"
          onClick={() => handleOpen("SHORT")}
          disabled={disabled || pending || availableCash <= 0}
        >
          {pending ? (
            "Filling…"
          ) : (
            <>
              Short <kbd className="keycap">S</kbd>
            </>
          )}
          <FillEstimate side="SHORT" notional={notional} impact={impact} />
        </button>
      </div>
    </div>
  );
}

export default memo(TradeDeck);

