import { TrendingUp } from "lucide-react";

export default function LeaderboardPane({ leaderboard, user }) {
  return (
    <div
      className="glass-panel"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <h2 className="text-blue mono flex-center" style={{ gap: "8px" }}>
        <TrendingUp /> LEADERBOARD
      </h2>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {leaderboard.map((p, idx) => (
          <div
            key={p.userId}
            style={{
              background: "rgba(0,0,0,0.4)",
              padding: "12px",
              borderRadius: "8px",
              borderLeft:
                p.userId === user?.id
                  ? "4px solid var(--accent-blue)"
                  : "none",
            }}
          >
            <div className="flex-between">
              <strong className="mono">
                #{idx + 1} {p.username}
              </strong>
              <span className={p.pnl >= 0 ? "text-green" : "text-red"}>
                {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(2)}
              </span>
            </div>
            <div
              className="text-secondary mono"
              style={{ fontSize: "0.9rem", marginTop: "4px" }}
            >
              NW: ${p.netWorth.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
