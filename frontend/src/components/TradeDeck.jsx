import { useState } from "react";
import { money, price as fmtPrice, signedMoney, toneOf } from "../lib/format";

/**
 * Four controls, and no more. Direction, leverage, size, and the nerve to close — those
 * are the decisions the game is about, so an order type or a limit price would only get
 * in their way.
 */
export default function TradeDeck({ me, livePrice, onOpen, onClose, disabled }) {
  const [leverage, setLeverage] = useState(3);
  const [size, setSize] = useState(50);

  const position = me?.position;

  if (position) {
    return (
      <div className="deck deck-open">
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
          <span className={`display deck-pnl ${toneOf(position.unrealisedPnl)}`}>
            {signedMoney(position.unrealisedPnl)}
          </span>
        </div>

        <button className="btn btn-big btn-scream deck-close" onClick={onClose} disabled={disabled}>
          Close
        </button>
      </div>
    );
  }

  const margin = ((me?.equity ?? 0) * size) / 100;

  return (
    <div className="deck">
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

      <div className="deck-sides">
        <button
          className="btn btn-big btn-pump"
          onClick={() => onOpen("LONG", size / 100, leverage)}
          disabled={disabled}
        >
          Long
        </button>
        <button
          className="btn btn-big btn-dump"
          onClick={() => onOpen("SHORT", size / 100, leverage)}
          disabled={disabled}
        >
          Short
        </button>
      </div>
    </div>
  );
}
