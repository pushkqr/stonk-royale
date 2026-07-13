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
  const { user, firebaseUser } = useAuth();
  const stompClient = useSocket();

  const [leaderboard, setLeaderboard] = useState([]);
  const [chatFeed, setChatFeed] = useState([]);
  const [chatInput, setChatInput] = useState("");

  const [activeCoin, setActiveCoin] = useState("BTC");
  const [prices, setPrices] = useState({ BTC: 0, ETH: 0, SOL: 0, DOGE: 0 });
  const [liveHistData, setLiveHistData] = useState(null);
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
    if (!stompClient || !user) return;

    const lbSub = stompClient.subscribe(`/topic/room/${roomCode}/leaderboard`, (msg) => {
      const data = JSON.parse(msg.body);
      setLeaderboard(data);
      const me = data.find((p) => p.user.id === user.id);
      if (me) setMyPortfolio(me);
    });

    const chatSub = stompClient.subscribe(`/topic/room/${roomCode}/chat`, (msg) => {
      setChatFeed((prev) => [...prev, { ...JSON.parse(msg.body), type: "CHAT" }]);
    });

    const tradeSub = stompClient.subscribe(`/topic/room/${roomCode}/trades`, (msg) => {
      setChatFeed((prev) => [...prev, { ...JSON.parse(msg.body), type: "TRADE" }]);
    });

    const gameOverSub = stompClient.subscribe(`/topic/room/${roomCode}/gameOver`, (msg) => {
      const payload = JSON.parse(msg.body);
      navigate(`/results/${roomCode}`, { state: { payload } });
    });

    const startSub = stompClient.subscribe(`/topic/room/${roomCode}/start`, (msg) => {
      const payload = JSON.parse(msg.body);
      if (payload.endTime) setEndTime(payload.endTime);
    });

    return () => {
      lbSub.unsubscribe();
      chatSub.unsubscribe();
      tradeSub.unsubscribe();
      gameOverSub.unsubscribe();
      startSub.unsubscribe();
    };
  }, [stompClient, user, roomCode, navigate]);

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
    if (!user || !firebaseUser || !roomCode) return;
    const fetchHistory = async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch(`http://localhost:8080/api/room/${roomCode}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const roomData = await res.json();
          if (!endTime && roomData.endTime) {
            setEndTime(roomData.endTime);
          }
        }
        
        // Fetch historical data directly over HTTP to bypass WebSocket/Jackson issues!
        const histRes = await fetch(`http://localhost:8080/api/room/historical/${roomCode}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (histRes.ok) {
          const histData = await histRes.json();
          setLiveHistData(histData);
        }

        const tradeRes = await fetch(
          `http://localhost:8080/api/trade/history/${roomCode}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }
        );
        const data = await tradeRes.json();
        // Fallback for API response variations: if it's an array directly or {success, transactions}
        if (Array.isArray(data)) setMyTrades(data);
        else if (data.transactions) setMyTrades(data.transactions);
      } catch (err) {
        console.error("Failed to fetch trade history", err);
      }
    };
    fetchHistory();
  }, [user, firebaseUser, roomCode]);

  // 2. Live Price Updates (Updating Ticker Only)
  useEffect(() => {
    if (!stompClient) return;

    const priceSub = stompClient.subscribe("/topic/prices", (msg) => {
      const allPrices = JSON.parse(msg.body);
      setPrices(allPrices);
      
      // Accumulate live prices so switching coins doesn't leave gaps
      setLiveHistData((prevHist) => {
        if (!prevHist) return prevHist;
        const time = Date.now();
        const newHist = { ...prevHist };
        Object.keys(allPrices).forEach(coin => {
          if (newHist[coin]) {
            newHist[coin] = [...newHist[coin], { time, price: allPrices[coin] }];
          }
        });
        return newHist;
      });
      
    });

    return () => priceSub.unsubscribe();
  }, [stompClient]);

  // 4. Actions
  const handleTrade = async (type, quantity) => {
    if (!quantity || quantity <= 0) return;

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("http://localhost:8080/api/trade/", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({
          roomCode,
          ticker: activeCoin,
          type,
          quantity: Number(quantity),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || data.error || "Trade failed");
      } else {
        console.log(`Trade successful: ${type} ${quantity} ${activeCoin}`);
        setMyTrades((prev) => [...prev, data]);

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
    stompClient.publish({
      destination: `/app/chat/${roomCode}`,
      body: JSON.stringify({
        username: user.username,
        text: chatInput,
      })
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
            historicalData={liveHistData}
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
