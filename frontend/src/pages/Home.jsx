import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LogIn, Play, PlusCircle, Settings } from "lucide-react";

export default function Home() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [roomSettings, setRoomSettings] = useState({
    starting_balance: 100000,
    max_players: 20,
    duration_minutes: 60
  });

  const handleCreateRoom = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roomSettings)
      });
      const data = await res.json();
      if (data.success) {
        handleJoinRoom(data.room.room_code);
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleJoinRoom = async (code = joinCode) => {
    if (!user || !code) return;
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, roomCode: code })
      });
      const data = await res.json();
      if (data.success) {
        navigate(`/lobby/${code}`);
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <div className="flex-center" style={{ minHeight: "100vh", flexDirection: "column", gap: "2rem", position: "relative" }}>
      
      {/* Unskippable Login Modal Overlay */}
      {!user && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(8px)",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column"
        }}>
          <h2 className="text-blue mono" style={{ marginBottom: "2rem", fontSize: "2rem" }}>AUTHENTICATION REQUIRED</h2>
          <div className="glass-panel" style={{ width: "400px", textAlign: "center" }}>
            <p className="text-secondary mb-4" style={{ marginBottom: "1.5rem" }}>Please sign in to access Stonk Royale.</p>
            <button className="btn btn-primary" onClick={login} style={{ width: "100%", height: "60px", fontSize: "1.2rem" }}>
              <LogIn size={24} /> Login with Google
            </button>
          </div>
        </div>
      )}

      {/* Main Home Screen (Visible underneath but blocked by modal if not logged in) */}
      <div style={{ textAlign: "center", zIndex: 10 }}>
        <h1 className="text-green" style={{ fontSize: "5rem", textShadow: "0 0 30px var(--accent-green-glow)" }}>
          STONK ROYALE
        </h1>
        <p className="text-secondary mono" style={{ fontSize: "1.2rem", marginTop: "1rem" }}>
          THE ULTIMATE 60-MINUTE PAPER TRADING DEATHMATCH
        </p>
      </div>

      <div className="glass-panel" style={{ width: "450px", display: "flex", flexDirection: "column", gap: "1.5rem", zIndex: 10 }}>
        {user && (
          <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
            <p style={{ fontSize: "1.1rem" }}>Welcome back, <span className="text-blue font-bold">{user.username}</span>!</p>
          </div>
        )}
        
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button className="btn btn-success" onClick={handleCreateRoom} disabled={loading || !user} style={{ padding: "16px", fontSize: "1.2rem", width: "100%" }}>
            <PlusCircle size={24} /> Create New Room
          </button>
          
          <button className="btn" onClick={() => setShowAdvanced(!showAdvanced)} style={{ width: "100%", fontSize: "0.9rem", padding: "8px", background: "transparent", border: "1px dashed var(--panel-border)" }}>
            <Settings size={16} /> {showAdvanced ? "Hide Advanced Settings" : "Advanced Settings"}
          </button>
        </div>

        {showAdvanced && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--panel-border)" }}>
            <div>
              <label className="text-secondary mono" style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.4rem" }}>STARTING BALANCE ($)</label>
              <input type="number" min="100" className="input-field mono" value={roomSettings.starting_balance} onChange={e => setRoomSettings({...roomSettings, starting_balance: Math.max(100, parseInt(e.target.value) || 100)})} />
            </div>
            <div className="flex-between" style={{ gap: "1rem" }}>
              <div style={{ flex: 1 }}>
                <label className="text-secondary mono" style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.4rem" }}>MAX PLAYERS</label>
                <input type="number" min="2" max="100" className="input-field mono" value={roomSettings.max_players} onChange={e => setRoomSettings({...roomSettings, max_players: Math.max(2, parseInt(e.target.value) || 2)})} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="text-secondary mono" style={{ fontSize: "0.8rem", display: "block", marginBottom: "0.4rem" }}>DURATION (MIN)</label>
                <input type="number" min="1" className="input-field mono" value={roomSettings.duration_minutes} onChange={e => setRoomSettings({...roomSettings, duration_minutes: Math.max(1, parseInt(e.target.value) || 1)})} />
              </div>
            </div>
          </div>
        )}
        
        <div style={{ position: "relative", margin: "1rem 0", textAlign: "center" }}>
          <hr style={{ borderColor: "var(--panel-border)", margin: "0" }} />
          <span className="text-secondary mono" style={{ position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)", background: "var(--bg-color)", padding: "0 10px" }}>OR</span>
        </div>

        <div className="flex-between" style={{ gap: "1rem" }}>
          <input 
            type="text" 
            className="input-field mono" 
            placeholder="ENTER 5-LETTER CODE" 
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={5}
            style={{ textAlign: "center", textTransform: "uppercase", height: "60px", fontSize: "1.5rem", letterSpacing: "5px" }}
            disabled={!user}
          />
          <button className="btn btn-primary" onClick={() => handleJoinRoom()} disabled={loading || joinCode.length !== 5 || !user} style={{ height: "60px", padding: "0 24px" }}>
            <Play size={24} /> Join
          </button>
        </div>
      </div>
    </div>
  );
}
