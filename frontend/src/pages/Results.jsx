import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Trophy, ArrowLeft } from "lucide-react";

export default function Results() {
  const { roomCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // The backend payload emitted on game_over: { message, leaderboard, winner }
  const payload = location.state?.payload;
  
  if (!payload || !payload.leaderboard) {
    return (
      <div className="flex-center" style={{ minHeight: "100vh", flexDirection: "column", gap: "2rem" }}>
        <h1 className="text-red mono">RESULTS NOT FOUND</h1>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          <ArrowLeft size={20} style={{ marginRight: "8px", verticalAlign: "middle" }} /> Back to Home
        </button>
      </div>
    );
  }

  const { leaderboard, winner } = payload;

  return (
    <div className="flex-center" style={{ minHeight: "100vh", flexDirection: "column", padding: "2rem" }}>
      
      {/* WINNER BANNER */}
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <Trophy size={64} className="text-blue" style={{ marginBottom: "1rem" }} />
        <h1 className="text-blue mono" style={{ fontSize: "3.5rem", textShadow: "0 0 20px rgba(0, 229, 255, 0.5)" }}>
          TOURNAMENT OVER
        </h1>
        <h2 className="text-green mono" style={{ fontSize: "2rem", marginTop: "1rem" }}>
          WINNER: {winner?.user?.username}
        </h2>
        <div className="text-secondary mono" style={{ fontSize: "1.2rem", marginTop: "0.5rem" }}>
          Final Net Worth: ${winner?.netWorth.toFixed(2)}
        </div>
      </div>

      {/* LEADERBOARD TABLE */}
      <div className="glass-panel" style={{ width: "100%", maxWidth: "800px", padding: "2rem", marginBottom: "3rem" }}>
        <h3 className="mono text-secondary" style={{ marginBottom: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "1rem" }}>
          FINAL RANKINGS
        </h3>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {leaderboard.map((player, idx) => (
            <div 
              key={player.userId} 
              className="flex-between"
              style={{ 
                padding: "1rem", 
                background: idx === 0 ? "rgba(0, 229, 255, 0.1)" : "rgba(0,0,0,0.3)", 
                borderRadius: "8px",
                border: idx === 0 ? "1px solid var(--neon-blue)" : "1px solid rgba(255,255,255,0.05)"
              }}
            >
              <div className="flex-center" style={{ gap: "1rem" }}>
                <span className="mono" style={{ fontSize: "1.5rem", color: idx === 0 ? "var(--neon-blue)" : "var(--text-secondary)" }}>
                  #{idx + 1}
                </span>
                <span className="mono" style={{ fontSize: "1.2rem", fontWeight: idx === 0 ? "bold" : "normal" }}>
                  {player.user?.username}
                </span>
              </div>

              <div style={{ textAlign: "right" }}>
                <div className="mono text-green" style={{ fontSize: "1.2rem" }}>
                  ${player.netWorth.toFixed(2)}
                </div>
                <div className={`mono ${player.pnl >= 0 ? "text-green" : "text-red"}`} style={{ fontSize: "0.9rem" }}>
                  {player.pnl >= 0 ? "+" : ""}${player.pnl.toFixed(2)} PnL
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ACTIONS */}
      <button className="btn btn-primary" style={{ fontSize: "1.2rem", padding: "1rem 2rem" }} onClick={() => navigate("/")}>
        <ArrowLeft size={24} style={{ marginRight: "12px", verticalAlign: "middle" }} /> 
        RETURN TO ARCADE
      </button>

    </div>
  );
}
