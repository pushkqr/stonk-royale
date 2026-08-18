import { memo, useCallback, useEffect, useRef, useState } from "react";
import { money, price as fmtPrice } from "../lib/format";
import LivePnl from "./LivePnl";
import FillEstimate from "./FillEstimate";
import { getLivePrice } from "../state/livePrice";
import { haptic } from "../lib/haptic";
import { unrealisedPnl } from "../lib/pnl";

const PRESETS = [
  { label: "Safe", lev: 2, sz: 25 },
  { label: "Standard", lev: 4, sz: 50 },
  { label: "YOLO", lev: 10, sz: 100 },
];

/**
 * Long enough to swallow a physical double-click, short enough that nobody deliberately
 * trading fast will ever meet it. Not a server-confirmation wait — see the note on
 * the in-flight lock being gone.
 */
const ACTION_LOCK_MS = 150;

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
  const [closing, setClosing] = useState(false);
  const [optimisticPos, setOptimisticPos] = useState(null);
  const [prevPosition, setPrevPosition] = useState(me?.position);

  if (me?.position !== prevPosition) {
    setPrevPosition(me?.position);
    setOptimisticPos(null);
    setClosing(false);
  }

  // A double-click lands on whatever the optimistic swap just moved under the cursor, so
  // the two actions still need separating — but by a fixed 150ms, not by the server.
  const lastActionAt = useRef(0);
  const takeActionLock = useCallback(() => {
    const now = Date.now();
    if (now - lastActionAt.current < ACTION_LOCK_MS) return false;
    lastActionAt.current = now;
    return true;
  }, []);

  // An optimistic overlay the server never contradicts must not stick. A rejected open is
  // the case that matters: `me.position` stays null, so the reconciliation above never
  // fires and the phantom card would otherwise live forever.
  useEffect(() => {
    if (!optimisticPos && !closing) return;
    const timer = setTimeout(() => {
      setOptimisticPos(null);
      setClosing(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [optimisticPos, closing]);

  const position = closing ? null : (optimisticPos || me?.position);

  const applyPreset = useCallback((p) => {
    setLeverage(p.lev);
    setSize(p.sz);
    haptic.tap();
  }, []);

  const handleOpen = useCallback(
    (side) => {
      if (!takeActionLock()) return;
      const livePrice = getLivePrice() || 1;
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
      setClosing(false);
      haptic.trade();
      onOpen(side, size / 100, leverage);
    },
    [onOpen, size, leverage, me?.cash, me?.equity, takeActionLock]
  );

  const handleClose = useCallback(() => {
    if (!takeActionLock()) return;
    const livePrice = getLivePrice();
    if (position) {
      const pnlVal = livePrice != null ? unrealisedPnl(position, livePrice) : (position.unrealisedPnl ?? 0);
      if (pnlVal >= 0) {
        haptic.success();
      } else {
        haptic.loss();
      }
    } else {
      haptic.tap();
    }
    setClosing(true);
    setOptimisticPos(null);
    onClose(position, livePrice);
  }, [onClose, position, takeActionLock]);

  useEffect(() => {
    if (disabled) return;

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
          applyPreset(PRESETS[0]);
        } else if (e.key === "2") {
          e.preventDefault();
          applyPreset(PRESETS[1]);
        } else if (e.key === "3") {
          e.preventDefault();
          applyPreset(PRESETS[2]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, position, handleClose, handleOpen, applyPreset]);

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
          disabled={disabled}
        >
          Close Position <kbd className="keycap">Space</kbd>
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
              onClick={() => applyPreset(p)}
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
          disabled={disabled || availableCash <= 0}
        >
          Long <kbd className="keycap">L</kbd>
          <FillEstimate side="LONG" notional={notional} impact={impact} />
        </button>
        <button
          className="btn btn-big btn-dump"
          onClick={() => handleOpen("SHORT")}
          disabled={disabled || availableCash <= 0}
        >
          Short <kbd className="keycap">S</kbd>
          <FillEstimate side="SHORT" notional={notional} impact={impact} />
        </button>
      </div>
    </div>
  );
}

export default memo(TradeDeck);

