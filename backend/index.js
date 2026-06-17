import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import "dotenv/config";

import tradeRoutes from "./api/routes/trade.routes.js";
import userRoutes from "./api/routes/user.routes.js";
import roomRoutes from "./api/routes/room.routes.js";
import { connectBinance } from "./services/binance.service.js";
import { setupSocketHandlers } from "./socket/socket.handler.js";

const app = express();
const server = createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // allow all for now
    methods: ["GET", "POST"],
  },
});

// --- Middlewares --- //
app.use(cors());
app.use(express.json());

// Pass socket.io instance to Express so controllers can use it
app.set("io", io);

// --- Routes --- //
app.use("/api/trade", tradeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/rooms", roomRoutes);

// --- WebSocket Services --- //
// Start watching Binance Streams & passing io for broadcasts
connectBinance(io);

// Start Leaderboard Service (broadcasts PnL every 2s)
import { startLeaderboardService } from "./services/leaderboard.service.js";
startLeaderboardService(io);

// Start End-Game Timer Service (liquidates assets when time is up)
import { startEndGameService } from "./services/endgame.service.js";
startEndGameService(io);

// --- Socket.io Handlers --- //
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on PORT: ${PORT}`);
});
