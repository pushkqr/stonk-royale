import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import "dotenv/config";

import tradeRoutes from "./api/routes/trade.routes.js";
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

// Inject io into express app so controllers/routes have access
app.set("io", io);

app.use(express.json());
app.use(cors());

// --- REST API Routes --- //
app.use("/api/trade", tradeRoutes);

// --- WebSocket Services --- //
// Start watching Binance Streams & passing io for broadcasts
connectBinance(io);

// --- Socket.io Handlers --- //
setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on PORT: ${PORT}`);
});
