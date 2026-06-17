import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import LeaderboardPane from "../components/game/LeaderboardPane";
import ChatPane from "../components/game/ChatPane";
import TradingPanes from "../components/game/TradingPanes";
import ChartWidget from "../components/game/ChartWidget";

export default function Game() {
  const { roomCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();

  const [leaderboard, setLeaderboard] = useState([]);
  const [chatFeed, setChatFeed] = useState([]);
  const [chatInput, setChatInput] = useState("");

  const [activeCoin, setActiveCoin] = useState("BTC");
  const [prices, setPrices] = useState({ BTC: 0, ETH: 0, SOL: 0, DOGE: 0 });
  const [myPortfolio, setMyPortfolio] = useState({
    availableCash: 0,
    netWorth: 0,
    holdings: [],
  });
  const [myTrades, setMyTrades] = useState([]);

  const [buyQuantity, setBuyQuantity] = useState("");
  const [sellQuantity, setSellQuantity] = useState("");

  const [endTime, setEndTime] = useState(location.state?.payload?.endTime || null);
  const [timeLeft, setTimeLeft] = useState("--:--");

  // 1. WebSocket Listeners & Game State
  useEffect(() => {
    if (!socket || !user) return;

    // Join room logic (in case of refresh)
    socket.emit("join_room", { roomCode, userId: user.id });

    // If we received historicalData from Lobby transition, we'll initialize charts later

    socket.on("leaderboard_update", (data) => {
      setLeaderboard(data);
      const me = data.find((p) => p.userId === user.id);
      if (me) setMyPortfolio(me);
    });

    socket.on("chat_message", (msg) => {
      setChatFeed((prev) => [...prev, { ...msg, type: "CHAT" }]);
    });

    socket.on("activity_feed", (feed) => {
      setChatFeed((prev) => [...prev, { ...feed, type: "TRADE" }]);
    });

    socket.on("game_over", (payload) => {
      navigate(`/results/${roomCode}`, { state: { payload } });
    });

    socket.on("room_error", (error) => {
      alert(error.message);
      navigate("/");
    });

    socket.on("game_started", (payload) => {
      if (payload.endTime) setEndTime(payload.endTime);
    });

    return () => {
      socket.off("leaderboard_update");
      socket.off("chat_message");
      socket.off("activity_feed");
      socket.off("game_over");
      socket.off("room_error");
      socket.off("game_started");
    };
  }, [socket, user, roomCode, navigate]);

  // Timer Countdown Effect
  useEffect(() => {
    if (!endTime) return;
    const interval = setInterval(() => {
      const now = new Date();
      const end = new Date(endTime);
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft("00:00");
        clearInterval(interval);
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  // Fetch Trade History on Load
  useEffect(() => {
    if (!user || !roomCode) return;
    const fetchHistory = async () => {
      try {
        const res = await fetch(
          `http://localhost:8000/api/trade/history/${roomCode}/${user.id}`,
        );
        const data = await res.json();
        if (data.success) setMyTrades(data.transactions);
      } catch (err) {
        console.error("Failed to fetch trade history", err);
      }
    };
    fetchHistory();
  }, [user, roomCode]);

  // 2. Live Price Updates (Updating Ticker Only)
  useEffect(() => {
    if (!socket) return;

    const handlePriceUpdate = (payload) => {
      // payload is { symbol: "BTC", price: 60000 }
      setPrices((prev) => ({ ...prev, [payload.symbol]: payload.price }));
    };

    socket.on("price_update", handlePriceUpdate);
    return () => socket.off("price_update", handlePriceUpdate);
  }, [socket]);

  // 4. Actions
  const handleTrade = async (type, quantity) => {
    if (!quantity || quantity <= 0) return;

    try {
      const res = await fetch("http://localhost:8000/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          roomCode,
          ticker: activeCoin,
          type,
          quantity: Number(quantity),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error);
      } else {
        console.log(`Trade successful: ${type} ${quantity} ${activeCoin}`);
        if (data.trade) setMyTrades((prev) => [...prev, data.trade]);

        if (type === "BUY") setBuyQuantity("");
        if (type === "SELL") setSellQuantity("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit("chat_message", {
      roomCode,
      username: user.username,
      text: chatInput,
    });
    setChatInput("");
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "300px 1fr 300px",
        height: "100vh",
        padding: "16px",
        gap: "16px",
      }}
    >
      {/* LEFT PANE: LEADERBOARD */}
      <LeaderboardPane leaderboard={leaderboard} user={user} />

      {/* CENTER PANE: TRADING DESK */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Top Info Bar */}
        <div className="glass-panel flex-between">
          <div className="flex-center" style={{ gap: "1rem" }}>
            {["BTC", "ETH", "SOL", "DOGE"].map((coin) => (
              <button
                key={coin}
                className={`btn ${activeCoin === coin ? "btn-primary" : ""}`}
                onClick={() => setActiveCoin(coin)}
              >
                {coin}
              </button>
            ))}
          </div>

          <div className="flex-center" style={{ flexDirection: "column" }}>
            <div className="text-secondary mono" style={{ fontSize: "0.8rem", letterSpacing: "2px" }}>TIME REMAINING</div>
            <div className={`mono ${timeLeft === "00:00" ? "text-red" : "text-blue"}`} style={{ fontSize: "2rem", textShadow: "0 0 10px rgba(0, 229, 255, 0.5)" }}>
              {timeLeft}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div className="text-secondary mono">Available Cash</div>
            <div className="text-green mono" style={{ fontSize: "1.5rem" }}>
              ${myPortfolio?.availableCash?.toFixed(2) || "0.00"}
            </div>
          </div>
        </div>

        {/* Chart Area */}
        <div
          className="glass-panel"
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
        >
          <div className="flex-between" style={{ marginBottom: "1rem" }}>
            <h2>{activeCoin} / USDT</h2>
            <h1
              className="mono"
              style={{
                fontSize: "3rem",
                textShadow: "0 0 20px rgba(255,255,255,0.2)",
              }}
            >
              ${prices[activeCoin]?.toFixed(2)}
            </h1>
          </div>
          <ChartWidget 
            activeCoin={activeCoin}
            livePrice={prices[activeCoin]}
            myTrades={myTrades}
            historicalData={location.state?.payload?.historicalData}
          />

          {/* Action Buttons: Dual Pane Trading Desk */}
          <TradingPanes
            activeCoin={activeCoin}
            prices={prices}
            myPortfolio={myPortfolio}
            buyQuantity={buyQuantity}
            setBuyQuantity={setBuyQuantity}
            sellQuantity={sellQuantity}
            setSellQuantity={setSellQuantity}
            handleTrade={handleTrade}
          />
        </div>
      </div>

      {/* RIGHT PANE: ACTIVITY FEED */}
      <ChatPane 
        chatFeed={chatFeed}
        chatInput={chatInput}
        setChatInput={setChatInput}
        sendChat={sendChat}
      />
    </div>
  );
}
