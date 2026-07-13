import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { CheckCircle, Users } from "lucide-react";

export default function Lobby() {
  const { roomCode } = useParams();
  const { user, firebaseUser } = useAuth();
  const stompClient = useSocket();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!user || !firebaseUser || !stompClient) return;

    // Fetch initial room state
    const fetchRoom = async () => {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`http://localhost:8080/api/room/${roomCode}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const roomData = await res.json();
        setRoom(roomData);
        const me = roomData.users.find(p => p.user.id === user.id);
        if (me && me.isReady) setIsReady(true);
        
        // Removed automatic redirect to prevent race condition with /start STOMP message
        // The game will only start via the /start STOMP payload
      }
    };
    fetchRoom();

    // STOMP Subscriptions
    const readySub = stompClient.subscribe(`/topic/room/${roomCode}/readyStatus`, () => {
      fetchRoom();
    });
    
    const startSub = stompClient.subscribe(`/topic/room/${roomCode}/start`, (message) => {
      const payload = JSON.parse(message.body);
      navigate(`/game/${roomCode}`, { state: { payload } });
    });

    return () => {
      readySub.unsubscribe();
      startSub.unsubscribe();
    };
  }, [stompClient, user, firebaseUser, roomCode, navigate]);

  const handleReady = () => {
    stompClient.publish({
      destination: `/app/ready/${roomCode}`,
      body: JSON.stringify({ uid: firebaseUser.uid })
    });
    setIsReady(true);
  };

  if (!room) return <div className="flex-center" style={{ height: "100vh" }}>Loading...</div>;

  return (
    <div className="flex-center" style={{ minHeight: "100vh", flexDirection: "column", gap: "2rem" }}>
      <div className="glass-panel" style={{ width: "600px", textAlign: "center" }}>
        <h2 className="text-blue mono" style={{ fontSize: "2rem" }}>ROOM: {roomCode}</h2>
        <p className="text-secondary" style={{ marginTop: "0.5rem" }}>Waiting for players to ready up...</p>
        
        <div style={{ margin: "2rem 0", display: "grid", gap: "1rem" }}>
          {room.users.map((p) => (
            <div key={p.id} className="flex-between" style={{ background: "rgba(0,0,0,0.4)", padding: "12px", borderRadius: "8px" }}>
              <div className="flex-center" style={{ gap: "10px" }}>
                <Users size={18} className="text-secondary" />
                <span style={{ fontWeight: p.user.id === user?.id ? "bold" : "normal" }}>
                  {p.user.username} {p.user.id === user?.id && "(You)"}
                </span>
              </div>
              <div>
                { (p.isReady || (p.user.id === user?.id && isReady)) ? (
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
