import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { CheckCircle, Users } from "lucide-react";

export default function Lobby() {
  const { roomCode } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!user || !socket) return;

    // Fetch initial room state
    const fetchRoom = async () => {
      const res = await fetch(`http://localhost:8000/api/rooms/${roomCode}`);
      const data = await res.json();
      if (data.success) {
        setRoom(data.room);
        const me = data.room.players.find(p => p.user_id === user.id);
        if (me) setIsReady(me.is_ready);
        
        // If room is already active, redirect to game
        if (data.room.status === "ACTIVE") {
          navigate(`/game/${roomCode}`);
        }
      }
    };
    fetchRoom();

    // Connect to socket room
    socket.emit("join_room", { roomCode, userId: user.id });

    // Socket Listeners
    socket.on("user_joined", fetchRoom);
    socket.on("player_ready_status", fetchRoom);
    
    socket.on("game_started", (payload) => {
      // payload will have { startTime, endTime, historicalData }
      // Route to Game and pass the historical data to hydrate the charts instantly
      navigate(`/game/${roomCode}`, { state: { payload } });
    });

    socket.on("room_error", (error) => {
      alert(error.message);
      navigate("/");
    });

    return () => {
      socket.off("user_joined");
      socket.off("player_ready_status");
      socket.off("game_started");
      socket.off("room_error");
    };
  }, [socket, user, roomCode, navigate]);

  const handleReady = () => {
    socket.emit("player_ready", { roomCode, userId: user.id });
    setIsReady(true);
  };

  if (!room) return <div className="flex-center" style={{ height: "100vh" }}>Loading...</div>;

  return (
    <div className="flex-center" style={{ minHeight: "100vh", flexDirection: "column", gap: "2rem" }}>
      <div className="glass-panel" style={{ width: "600px", textAlign: "center" }}>
        <h2 className="text-blue mono" style={{ fontSize: "2rem" }}>ROOM: {roomCode}</h2>
        <p className="text-secondary" style={{ marginTop: "0.5rem" }}>Waiting for players to ready up...</p>
        
        <div style={{ margin: "2rem 0", display: "grid", gap: "1rem" }}>
          {room.players.map((p) => (
            <div key={p.id} className="flex-between" style={{ background: "rgba(0,0,0,0.4)", padding: "12px", borderRadius: "8px" }}>
              <div className="flex-center" style={{ gap: "10px" }}>
                <Users size={18} className="text-secondary" />
                <span style={{ fontWeight: p.user_id === user?.id ? "bold" : "normal" }}>
                  {p.user.username} {p.user_id === user?.id && "(You)"}
                </span>
              </div>
              <div>
                {p.is_ready ? (
                  <span className="text-green flex-center" style={{ gap: "5px" }}><CheckCircle size={16} /> Ready</span>
                ) : (
                  <span className="text-secondary">Waiting...</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <button 
          className={`btn ${isReady ? 'btn-success' : 'btn-primary'}`} 
          style={{ width: "100%", padding: "16px", fontSize: "1.2rem" }}
          onClick={handleReady}
          disabled={isReady}
        >
          {isReady ? "WAITING FOR OTHERS..." : "READY UP"}
        </button>
      </div>
    </div>
  );
}
