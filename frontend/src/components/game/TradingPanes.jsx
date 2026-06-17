export default function TradingPanes({
  activeCoin,
  prices,
  myPortfolio,
  buyQuantity,
  setBuyQuantity,
  sellQuantity,
  setSellQuantity,
  handleTrade,
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1rem",
        marginTop: "1rem",
      }}
    >
      {/* BUY PANEL */}
      <div
        style={{
          background: "rgba(0,0,0,0.3)",
          padding: "12px",
          borderRadius: "8px",
          border: "1px solid var(--panel-border)",
        }}
      >
        <div className="flex-between" style={{ marginBottom: "8px" }}>
          <span className="text-secondary mono" style={{ fontSize: "0.8rem" }}>
            Avbl
          </span>
          <span className="mono">
            ${myPortfolio?.availableCash?.toFixed(2) || "0.00"}
          </span>
        </div>
        <div className="flex-between" style={{ marginBottom: "12px" }}>
          <span className="text-secondary mono" style={{ fontSize: "0.8rem" }}>
            Max Buy
          </span>
          <span className="mono">
            {prices[activeCoin]
              ? ((myPortfolio?.availableCash || 0) / prices[activeCoin]).toFixed(4)
              : 0}{" "}
            {activeCoin}
          </span>
        </div>

        <div style={{ position: "relative", marginBottom: "12px" }}>
          <input
            type="number"
            className="input-field mono"
            placeholder="Amount"
            value={buyQuantity}
            onChange={(e) => setBuyQuantity(e.target.value)}
            style={{ width: "100%" }}
          />
          <span
            className="text-secondary mono"
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            {activeCoin}
          </span>
        </div>

        <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <button
              key={pct}
              className="btn"
              style={{
                flex: 1,
                padding: "4px",
                fontSize: "0.75rem",
                minWidth: 0,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.2)",
              }}
              onClick={() => {
                const max = prices[activeCoin]
                  ? (myPortfolio?.availableCash || 0) / prices[activeCoin]
                  : 0;
                setBuyQuantity((max * pct).toFixed(4));
              }}
            >
              {pct * 100}%
            </button>
          ))}
        </div>

        <div className="flex-between" style={{ marginBottom: "12px" }}>
          <span className="text-secondary mono" style={{ fontSize: "0.8rem" }}>
            Total
          </span>
          <span className="mono">
            ${(Number(buyQuantity) * (prices[activeCoin] || 0)).toFixed(2)}
          </span>
        </div>

        <button
          className="btn btn-success"
          style={{ width: "100%", height: "40px", fontSize: "1.1rem" }}
          onClick={() => handleTrade("BUY", buyQuantity)}
        >
          Buy {activeCoin}
        </button>
      </div>

      {/* SELL PANEL */}
      <div
        style={{
          background: "rgba(0,0,0,0.3)",
          padding: "12px",
          borderRadius: "8px",
          border: "1px solid var(--panel-border)",
        }}
      >
        <div className="flex-between" style={{ marginBottom: "8px" }}>
          <span className="text-secondary mono" style={{ fontSize: "0.8rem" }}>
            Avbl
          </span>
          <span className="mono">
            {myPortfolio?.holdings?.find((h) => h.ticker === activeCoin)
              ?.quantity || 0}{" "}
            {activeCoin}
          </span>
        </div>
        <div className="flex-between" style={{ marginBottom: "12px" }}>
          <span className="text-secondary mono" style={{ fontSize: "0.8rem" }}>
            Max Sell
          </span>
          <span className="mono">
            {myPortfolio?.holdings?.find((h) => h.ticker === activeCoin)
              ?.quantity || 0}{" "}
            {activeCoin}
          </span>
        </div>

        <div style={{ position: "relative", marginBottom: "12px" }}>
          <input
            type="number"
            className="input-field mono"
            placeholder="Amount"
            value={sellQuantity}
            onChange={(e) => setSellQuantity(e.target.value)}
            style={{ width: "100%" }}
          />
          <span
            className="text-secondary mono"
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            {activeCoin}
          </span>
        </div>

        <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <button
              key={pct}
              className="btn"
              style={{
                flex: 1,
                padding: "4px",
                fontSize: "0.75rem",
                minWidth: 0,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.2)",
              }}
              onClick={() => {
                const max =
                  myPortfolio?.holdings?.find((h) => h.ticker === activeCoin)
                    ?.quantity || 0;
                setSellQuantity((max * pct).toFixed(4));
              }}
            >
              {pct * 100}%
            </button>
          ))}
        </div>

        <div className="flex-between" style={{ marginBottom: "12px" }}>
          <span className="text-secondary mono" style={{ fontSize: "0.8rem" }}>
            Total
          </span>
          <span className="mono">
            ${(Number(sellQuantity) * (prices[activeCoin] || 0)).toFixed(2)}
          </span>
        </div>

        <button
          className="btn btn-danger"
          style={{ width: "100%", height: "40px", fontSize: "1.1rem" }}
          onClick={() => handleTrade("SELL", sellQuantity)}
        >
          Sell {activeCoin}
        </button>
      </div>
    </div>
  );
}
