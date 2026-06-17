import prisma from "../config/db.js";
import { cryptoPrices } from "../state/index.js";
import { getHistoricalCharts } from "../services/market.service.js";

export function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Send immediate price state upon connection
    socket.emit("initial_prices", cryptoPrices);

    // Join Room
    socket.on("join_room", async ({ roomCode, userId }) => {
      socket.join(roomCode);
      console.log(`User ${userId} joined room ${roomCode}`);

      // Announce to the rest of the room
      socket.to(roomCode).emit("user_joined", { userId });

      // If the room is already ACTIVE, send the historical data to this reconnecting user
      try {
        const room = await prisma.room.findUnique({ where: { room_code: roomCode } });
        if (room && room.status === "ACTIVE") {
          console.log(`Sending recovery game_started payload to reconnected user ${userId}`);
          const historicalData = await getHistoricalCharts(["BTC", "ETH", "SOL", "DOGE"]);
          socket.emit("game_started", { 
            startTime: room.start_time, 
            endTime: room.end_time, 
            historicalData 
          });
        }
      } catch (error) {
        console.error("Error sending recovery payload:", error);
      }
    });

    // Example Event: Global Chat
    socket.on("chat_message", ({ roomCode, username, text }) => {
      io.to(roomCode).emit("chat_message", {
        username,
        text,
        timestamp: Date.now(),
      });
    });

    // Example Event: Ready Up (for the tournament state machine)
    socket.on("player_ready", async ({ roomCode, userId }) => {
      try {
        const roomPlayer = await prisma.roomPlayer.findFirst({
          where: { user_id: userId, room: { room_code: roomCode } },
        });

        if (roomPlayer) {
          // Update ready status in DB
          await prisma.roomPlayer.update({
            where: { id: roomPlayer.id },
            data: { is_ready: true },
          });

          io.to(roomCode).emit("player_ready_status", {
            userId,
            isReady: true,
          });

          // Check if all players in the room are ready
          const room = await prisma.room.findUnique({
            where: { room_code: roomCode },
            include: { players: true },
          });

          if (room && room.status === "WAITING") {
            const allReady = room.players.every((p) => p.is_ready);
            if (allReady && room.players.length > 0) {
              // Require at least 1 player to start
              // Transition to ACTIVE state
              const now = new Date();
              const durationMs = (room.duration_minutes || 60) * 60 * 1000;
              const endTime = new Date(now.getTime() + durationMs); // dynamic tournament duration

              await prisma.room.update({
                where: { id: room.id },
                data: { status: "ACTIVE", start_time: now, end_time: endTime },
              });

              console.log(`Room ${roomCode} has started! Fetching historical charts...`);
              
              // Fetch the 60-minute historical sliding window for all coins
              const historicalData = await getHistoricalCharts(["BTC", "ETH", "SOL", "DOGE"]);

              io.to(roomCode).emit("game_started", { startTime: now, endTime, historicalData });
            }
          }
        }
      } catch (error) {
        console.error("Ready Up Error:", error);
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
